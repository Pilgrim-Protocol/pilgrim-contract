import { expect } from 'chai';
import { BigNumber, Signer } from 'ethers';
import { ethers } from 'hardhat';

import { deployAll } from '../../scripts/deploy/index';
import {
  AMMFacet,
  Diamond,
  DistributionFacet,
  ERC20Mock,
  ERC721Mock,
  ListingFacet,
  ManagingFacet,
  PilgrimToken,
} from '../../typechain';
import {
  dummyIpfsHash,
  listingPrice,
  mintNft,
  oneEther,
  runRWMethod,
  tenPercent,
  TradingHelper,
  zeroAddr,
} from '../testUtils';

describe('DistributionFacet', function () {
  let core: Diamond;
  let pilgrim: PilgrimToken;

  let ammFacet: AMMFacet;
  let distributionFacet: DistributionFacet;
  let listingFacet: ListingFacet;
  let managingFacet: ManagingFacet;

  let testERC20: ERC20Mock;
  let erc721: ERC721Mock;

  let user: Signer;
  let userAddr: string;

  let metaNftId: BigNumber;

  let tradingHelper: TradingHelper;

  this.beforeEach(async function () {
    // @ts-ignore
    ({ core, pilgrim, testERC20 } = await deployAll());

    ammFacet = await ethers.getContractAt('AMMFacet', core.address);
    distributionFacet = await ethers.getContractAt('DistributionFacet', core.address);
    listingFacet = await ethers.getContractAt('ListingFacet', core.address);
    managingFacet = await ethers.getContractAt('ManagingFacet', core.address);

    erc721 = await (await ethers.getContractFactory('ERC721Mock')).deploy('TestNFT', 'TNFT');

    [, user] = await ethers.getSigners();
    userAddr = await user.getAddress();

    await pilgrim.mint(oneEther.mul(1_000_000));
    await pilgrim.transfer(core.address, oneEther.mul(1_000_000));
    await testERC20.transfer(userAddr, oneEther.mul(1_000_000));
    await managingFacet.setRewardEpoch(1);
    await managingFacet.createPool(testERC20.address, 100, oneEther);
    const tokenId = await mintNft(erc721, user);
    await erc721.connect(user).approve(core.address, tokenId);
    const listResult = await runRWMethod({
      method: listingFacet
        .connect(user)
        .list(erc721.address, tokenId, listingPrice, testERC20.address, [], dummyIpfsHash),
      name: 'List',
    });
    metaNftId = listResult._metaNftId;

    tradingHelper = new TradingHelper(ammFacet, metaNftId, user, testERC20);
  });

  // Get reward epoch
  it('CORE_040101', async function (): Promise<void> {
    expect(await distributionFacet.getRewardEpoch()).to.equal(1);
  });

  // CORE_040201 is duplicated with CORE_050501
  // See 05_ManagingFacet.test.ts
  // Create distribution pool
  // it('CORE_040201', async function (): Promise<void> {
  // });

  // Get Distribution pool info with unregistered base token address
  it('CORE_040202', async function (): Promise<void> {
    const distPoolInfo = await distributionFacet.getDistPoolInfo(zeroAddr);
    expect(distPoolInfo._rewardParameter).to.equal(0);
    expect(distPoolInfo._gasReward).to.equal(0);
  });

  // Get pair reward amount with listed MetaNFT ID
  it('CORE_040301', async function (): Promise<void> {
    await tradingHelper.buyRounds(tenPercent);
    await tradingHelper.buyRounds(tenPercent);
    expect(await distributionFacet.getPairReward(metaNftId)).to.gt(0);
  });

  // Get user reward amount with user account address
  it('CORE_040401', async function (): Promise<void> {
    await tradingHelper.buyRounds(tenPercent);
    await tradingHelper.buyRounds(tenPercent);
    expect(await distributionFacet.getUserReward(userAddr)).to.gt(0);
  });

  // Claim pair reward by minted MetaNFT's owner
  it('CORE_040501', async function (): Promise<void> {
    await tradingHelper.buyRounds(tenPercent);
    await tradingHelper.buyRounds(tenPercent);
    const expectedReward = await distributionFacet.getPairReward(metaNftId);
    await distributionFacet.claimPairReward(metaNftId);
    expect(await pilgrim.balanceOf(userAddr)).to.equal(expectedReward);
  });

  // Claim pair reward with non-minted MetaNFT ID
  it('CORE_040502', async function (): Promise<void> {
    await expect(distributionFacet.claimPairReward(100)).to.be.revertedWith('Pilgrim: No Reward');
  });

  // Claim pair reward when reward amount is 0
  it('CORE_040503', async function (): Promise<void> {
    await expect(distributionFacet.claimPairReward(metaNftId)).to.be.revertedWith('Pilgrim: No Reward');
  });

  // Claim user reward
  it('CORE_040601', async function (): Promise<void> {
    await tradingHelper.buyRounds(tenPercent);
    await tradingHelper.buyRounds(tenPercent);
    const expectedReward = await distributionFacet.getUserReward(userAddr);
    await distributionFacet.connect(user).claimUserReward();
    expect(await pilgrim.balanceOf(userAddr)).to.equal(expectedReward);
  });

  // Claim user reward when reward amount is 0
  it('CORE_040602', async function (): Promise<void> {
    await expect(distributionFacet.connect(user).claimUserReward()).to.be.revertedWith('Pilgrim: No Reward');
  });
});
