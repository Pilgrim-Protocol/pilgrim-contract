import { expect } from 'chai';
import { BigNumber, Signer } from 'ethers';
import { ethers } from 'hardhat';

import { deployAll } from '../scripts/deploy';
import { FacetCutAction, getSelectors } from '../scripts/libraries/diamond/utils';
import {
  AMMFacet,
  CoreMigrationFacet,
  Diamond, DiamondCutFacet, DistributionFacet, ERC20Mock, ERC721Mock,
  ListingFacet,
  ManagingFacet,
  PilgrimToken,
  PilgrimTreasury, StakingMigrationFacet, ViewFacet, XPilgrim,
} from '../typechain';

import { deadline, dummyIpfsHash, mintNft, oneEther, zeroAddr } from './testUtils';
import { makeAccount } from 'hardhat/internal/hardhat-network/provider/utils/makeAccount';


describe('PIL Migration', function () {
  let core: Diamond;
  let staking: Diamond;
  let treasury: PilgrimTreasury;
  let pilgrim: PilgrimToken;
  let xPilgrim: XPilgrim;
  let newTreasury: PilgrimTreasury;

  let listingFacet: ListingFacet;
  let managingFacet: ManagingFacet;
  let ammFacet: AMMFacet;
  let viewFacet: ViewFacet;
  let distributionFacet: DistributionFacet;

  let coreMigrationFacet: CoreMigrationFacet;
  let stakingMigrationFacet: StakingMigrationFacet;
  let coreDiamondCutFacet: DiamondCutFacet;
  let stakingDiamondCutFacet: DiamondCutFacet;

  let testERC20: ERC20Mock;
  let erc721: ERC721Mock;
  let newPil: ERC20Mock;
  let weth: ERC20Mock;

  let owner: Signer;
  let user: Signer;

  this.beforeEach(async function () {
    // @ts-ignore
    ({ core, staking, treasury, pilgrim, xPilgrim, testERC20, weth } = await deployAll());

    managingFacet = await ethers.getContractAt('ManagingFacet', core.address);
    listingFacet = await ethers.getContractAt('ListingFacet', core.address);
    ammFacet = await ethers.getContractAt('AMMFacet', core.address);
    viewFacet = await ethers.getContractAt('ViewFacet', core.address);
    distributionFacet = await ethers.getContractAt('DistributionFacet', core.address);

    coreDiamondCutFacet = await ethers.getContractAt('DiamondCutFacet', core.address);
    stakingDiamondCutFacet = await ethers.getContractAt('DiamondCutFacet', staking.address);

    const deployedCoreMigFacet = await (await ethers.getContractFactory('CoreMigrationFacet')).deploy();
    await deployedCoreMigFacet.deployed();
    await coreDiamondCutFacet.diamondCut(
      [{
        facetAddress: deployedCoreMigFacet.address,
        action: FacetCutAction.Add,
        functionSelectors: getSelectors(deployedCoreMigFacet),
      }],
      zeroAddr,
      [],
    );
    coreMigrationFacet = await ethers.getContractAt('CoreMigrationFacet', core.address);

    const deployedStakingMigFacet = await (await ethers.getContractFactory('StakingMigrationFacet')).deploy();
    await deployedStakingMigFacet.deployed();
    await stakingDiamondCutFacet.diamondCut(
      [{
        facetAddress: deployedStakingMigFacet.address,
        action: FacetCutAction.Add,
        functionSelectors: getSelectors(deployedStakingMigFacet),
      }],
      zeroAddr,
      [],
    );
    stakingMigrationFacet = await ethers.getContractAt('StakingMigrationFacet', staking.address);

    erc721 = await (await ethers.getContractFactory('ERC721Mock')).deploy('Test', 'TEST');
    testERC20 = await (await ethers.getContractFactory('ERC20Mock')).deploy('Test', 'TEST', oneEther.mul(1_000_000_000));
    newPil = await (await ethers.getContractFactory('ERC20Mock')).deploy('NewPilgrim', 'NEWPIL', oneEther.mul(1_000_000_000));

    newTreasury = await (await ethers.getContractFactory('PilgrimTreasury')).deploy(
      newPil.address,
      [core.address, staking.address],
    );
    await newTreasury.deployed();

    await managingFacet.createPool(pilgrim.address, 1, oneEther);
    await managingFacet.createPool(testERC20.address, 1, oneEther);

    await managingFacet.setUniV3ExtraRewardParam(pilgrim.address, weth.address, 2);
    await managingFacet.setUniV3ExtraRewardParam(pilgrim.address, xPilgrim.address, 3);

    [owner, user] = await ethers.getSigners();
  });

  // Core migration
  it('PIL_MIGRATION_01', async function (): Promise<void> {
    const numPairs = 120;

    for (let i = 0; i < numPairs; i++) {
      const tokenId = await mintNft(erc721, user);
      await erc721.connect(user).approve(core.address, tokenId);
      await listingFacet
        .connect(user)
        .list(
          erc721.address,
          tokenId,
          oneEther,
          i % 2 === 0 ? pilgrim.address : testERC20.address,
          [],
          dummyIpfsHash,
        );
    }

    const pilAmount = oneEther.mul(Math.round(Math.random() * 1000 + 1000));
    await pilgrim.transfer(core.address, pilAmount);

    await newPil.approve(core.address, oneEther.mul(1_000_000_000));
    await coreMigrationFacet.migratePilToken(
      newPil.address,
      newTreasury.address,
      100,
      oneEther.mul(2),
      numPairs,
      xPilgrim.address,
    );

    // only PIL pairs must be changed to new PIL
    for (let i = 0; i < numPairs; i++) {
      const baseToken = await ammFacet.getBaseToken(i);
      expect(baseToken).to.equal(i % 2 === 0 ? newPil.address : testERC20.address);
    }

    // non-PIL distPool must not be changed
    const erc20PilDistPool = await distributionFacet.getDistPoolInfo(testERC20.address);
    expect(erc20PilDistPool._rewardParameter).to.equal(1);
    expect(erc20PilDistPool._gasReward).to.equal(oneEther);

    // old PIL distPool must be removed
    const oldPilDistPool = await distributionFacet.getDistPoolInfo(pilgrim.address);
    expect(oldPilDistPool._rewardParameter).to.equal(0);
    expect(oldPilDistPool._gasReward).to.equal(0);

    // new PIL distPool must be created
    const newPilDistPool = await distributionFacet.getDistPoolInfo(newPil.address);
    expect(newPilDistPool._rewardParameter).to.equal(100);
    expect(newPilDistPool._gasReward).to.equal(oneEther.mul(2));

    // old PIL extra reward params must be removed (set to 1)
    expect(await viewFacet.getUniV3ExtraRewardParam(pilgrim.address, weth.address)).to.equal(1);
    expect(await viewFacet.getUniV3ExtraRewardParam(pilgrim.address, xPilgrim.address)).to.equal(1);

    // new PIL extra reward params must be updated
    expect(await viewFacet.getUniV3ExtraRewardParam(newPil.address, weth.address)).to.equal(2);
    expect(await viewFacet.getUniV3ExtraRewardParam(newPil.address, xPilgrim.address)).to.equal(3);

    // balance of new PIL must be same with old PIL balance.
    expect(await newPil.balanceOf(core.address)).to.equal(pilAmount);
  });

  it('PIL_MIGRATION_02', async function (): Promise<void> {
    const tx = coreMigrationFacet.connect(user).migratePilToken(
      newPil.address,
      newTreasury.address,
      100,
      oneEther,
      100,
      xPilgrim.address,
    );
    await expect(tx).to.be.revertedWith('LibDiamond: Must be contract owner');
  });

  // Staking migration
  it('PIL_MIGRATION_03', async function (): Promise<void> {
    const pilAmount = oneEther.mul(Math.round(Math.random() * 1000 + 1000));
    await pilgrim.transfer(staking.address, pilAmount);

    await newPil.approve(staking.address, oneEther.mul(1_000_000_000));
    await stakingMigrationFacet.migratePilToken(
      newPil.address,
      newTreasury.address,
    );

    expect(await newPil.balanceOf(staking.address)).to.equal(pilAmount);
  });

  it('PIL_MIGRATION_04', async function (): Promise<void> {
    const tx = stakingMigrationFacet.connect(user).migratePilToken(
      newPil.address,
      newTreasury.address,
    );
    await expect(tx).to.be.revertedWith('LibDiamond: Must be contract owner');
  });
});
