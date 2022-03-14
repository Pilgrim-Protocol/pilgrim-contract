import { expect } from 'chai';
import { Signer } from 'ethers';
import { ethers } from 'hardhat';

import { deployAll } from '../../scripts/deploy/index';
import {
  Diamond,
  DistributionFacet,
  ERC20Mock,
  ManagingFacet,
  ViewFacet,
} from '../../typechain';
import { oneEther, zeroAddr } from '../testUtils';

describe('ManagingFacet', function () {
  let core: Diamond;
  let distributionFacet: DistributionFacet;
  let managingFacet: ManagingFacet;
  let viewFacet: ViewFacet;

  const erc20s: Array<ERC20Mock> = [];

  let nonOwner: Signer;

  this.beforeEach(async function () {
    ({ core } = await deployAll());

    distributionFacet = await ethers.getContractAt('DistributionFacet', core.address);
    managingFacet = await ethers.getContractAt('ManagingFacet', core.address);
    viewFacet = await ethers.getContractAt('ViewFacet', core.address);

    for (let i = 0; i < 3; i++) {
      erc20s.push(
        await (await ethers.getContractFactory('ERC20Mock')).deploy('TestToken', 'TEST', oneEther.mul(1_000_000_000)),
      );
    }

    [, nonOwner] = await ethers.getSigners();
  });

  // Halve rewards (Double rewardParameter) of all distribution pools
  it('CORE_050101', async function (): Promise<void> {
    for (let i = 0; i < 3; i++) {
      managingFacet.createPool(erc20s[i].address, i + 1, 1);
      expect(
        (await distributionFacet.getDistPoolInfo(erc20s[i].address))._rewardParameter,
      ).to.equal(i + 1);
    }

    await managingFacet.halveRewards();

    for (let i = 0; i < 3; i++) {
      expect(
        (await distributionFacet.getDistPoolInfo(erc20s[i].address))._rewardParameter,
      ).to.equal((i + 1) * 2);
    }
  });

  // Call by non-owner
  it('CORE_050102', async function (): Promise<void> {
    await expect(managingFacet.connect(nonOwner).halveRewards()).to.be.revertedWith('LibDiamond: Must be contract owner');
  });

  // Set rewardParameter
  it('CORE_050201', async function (): Promise<void> {
    managingFacet.createPool(erc20s[0].address, 1, 1);
    expect(
      (await distributionFacet.getDistPoolInfo(erc20s[0].address))._rewardParameter,
    ).to.equal(1);

    const rewardParameter = 123;
    managingFacet.setRewardParameter(erc20s[0].address, rewardParameter);
    expect(
      (await distributionFacet.getDistPoolInfo(erc20s[0].address))._rewardParameter,
    ).to.equal(rewardParameter);
  });

  // Call by non-owner
  it('CORE_050202', async function (): Promise<void> {
    await expect(
      managingFacet.connect(nonOwner).setRewardParameter(erc20s[0].address, 1),
    ).to.be.revertedWith('LibDiamond: Must be contract owner');
  });

  // Set rewardParameter to 0
  it('CORE_050203', async function (): Promise<void> {
    managingFacet.createPool(erc20s[0].address, 1, 1);
    await expect(managingFacet.setRewardParameter(erc20s[0].address, 0)).to.be.revertedWith('Pilgrim: Invalid rewardParamter');
  });

  // Set rewardParameter of unregistered base token
  it('CORE_050204', async function (): Promise<void> {
    await expect(managingFacet.setRewardParameter(erc20s[0].address, 1)).to.be.revertedWith('Pilgrim: baseToken Not Found');
  });

  // Set gasReward
  it('CORE_050301', async function (): Promise<void> {
    managingFacet.createPool(erc20s[0].address, 1, 1);
    expect(
      (await distributionFacet.getDistPoolInfo(erc20s[0].address))._gasReward,
    ).to.equal(1);

    const gasReward = 123;
    managingFacet.setGasReward(erc20s[0].address, gasReward);
    expect(
      (await distributionFacet.getDistPoolInfo(erc20s[0].address))._gasReward,
    ).to.equal(gasReward);
  });

  // Call by non-owner
  it('CORE_050302', async function (): Promise<void> {
    await expect(
      managingFacet.connect(nonOwner).setGasReward(erc20s[0].address, 1),
    ).to.be.revertedWith('LibDiamond: Must be contract owner');
  });

  // Set gasReward of unregistered base token
  it('CORE_050303', async function (): Promise<void> {
    await expect(managingFacet.setGasReward(erc20s[0].address, 1)).to.be.revertedWith('Pilgrim: baseToken Not Found');
  });

  // Set RewardEpoch
  it('CORE_050401', async function (): Promise<void> {
    const rewardEpoch = (await distributionFacet.getRewardEpoch()).add(100);
    await managingFacet.setRewardEpoch(rewardEpoch);
    expect(await distributionFacet.getRewardEpoch()).to.equal(rewardEpoch);
  });

  // Call by non-owner
  it('CORE_050402', async function (): Promise<void> {
    await expect(
      managingFacet.connect(nonOwner).setRewardEpoch(1),
    ).to.be.revertedWith('LibDiamond: Must be contract owner');
  });

  // Get Distribution pool info with base token address
  // Create distribution pool
  it('CORE_040201_CORE_050501', async function (): Promise<void> {
    const rewardEpoch = 123;
    const gasReward = 456;
    await managingFacet.createPool(erc20s[0].address, rewardEpoch, gasReward);
    const distPoolInfo = await distributionFacet.getDistPoolInfo(erc20s[0].address);
    expect(distPoolInfo._rewardParameter).to.equal(rewardEpoch);
    expect(distPoolInfo._gasReward).to.equal(gasReward);
  });

  // Call by non-owner
  it('CORE_050502', async function (): Promise<void> {
    await expect(
      managingFacet.connect(nonOwner).createPool(erc20s[0].address, 1, 1),
    ).to.be.revertedWith('LibDiamond: Must be contract owner');
  });

  // Create duplicated distribution pool
  it('CORE_050503', async function (): Promise<void> {
    await managingFacet.createPool(erc20s[0].address, 1, 1);
    await expect(managingFacet.createPool(erc20s[0].address, 1, 1)).to.be.revertedWith('Pilgrim: Duplicated baseToken');
  });

  // Create distribution pool with rewardParameter as 0
  it('CORE_050504', async function (): Promise<void> {
    await expect(managingFacet.createPool(erc20s[0].address, 0, 1)).to.be.revertedWith('Pilgrim: Invalid rewardParamter');
  });

  // Set bidTimeout
  it('CORE_050601', async function (): Promise<void> {
    const bidTimeout = 60 * 60 * 1234;
    await managingFacet.setBidTimeout(bidTimeout);
    expect(await viewFacet.getBidTimeout()).to.equal(bidTimeout);
  });

  // Set bidTimeout to 0
  it('CORE_050602', async function (): Promise<void> {
    await expect(managingFacet.setBidTimeout(0)).to.be.revertedWith('Pilgrim: Invalid bidTimeout');
  });

  // Call by non-owner
  it('CORE_050603', async function (): Promise<void> {
    await expect(managingFacet.connect(nonOwner).setBidTimeout(1000)).to.be.revertedWith('LibDiamond: Must be contract owner');
  });

  // Set uniV3ExtraRewardParam with same token addresses
  it('CORE_050702', async function (): Promise<void> {
    await expect(
      managingFacet.setUniV3ExtraRewardParam(zeroAddr, zeroAddr, 1),
    ).to.be.revertedWith('Pilgrim: Must be different tokens');
  });

  // Call by non-owner
  it('CORE_050703', async function (): Promise<void> {
    await expect(
      managingFacet.connect(nonOwner).setUniV3ExtraRewardParam(zeroAddr, zeroAddr, 1),
    ).to.be.revertedWith('LibDiamond: Must be contract owner');
  });

  // Set base fee numerator
  it('CORE_050801', async function (): Promise<void> {
    expect(await viewFacet.getBaseFee()).to.equal(1);
    await managingFacet.setBaseFee(100);
    expect(await viewFacet.getBaseFee()).to.equal(100);
  });

  // Call by non-owner
  it('CORE_050802', async function (): Promise<void> {
    await expect(managingFacet.connect(nonOwner).setBaseFee(100)).to.be.revertedWith('LibDiamond: Must be contract owner');
  });

  // Set round fee numerator
  it('CORE_050901', async function (): Promise<void> {
    expect(await viewFacet.getRoundFee()).to.equal(4);
    await managingFacet.setRoundFee(100);
    expect(await viewFacet.getRoundFee()).to.equal(100);
  });

  // Call by non-owner
  it('CORE_050902', async function (): Promise<void> {
    await expect(managingFacet.connect(nonOwner).setRoundFee(100)).to.be.revertedWith('LibDiamond: Must be contract owner');
  });

  // Set NFT/metaNFT fee numerator
  it('CORE_051001', async function (): Promise<void> {
    expect(await viewFacet.getNftFee()).to.equal(25);
    await managingFacet.setNftFee(100);
    expect(await viewFacet.getNftFee()).to.equal(100);
  });

  // Call by non-owner
  it('CORE_051002', async function (): Promise<void> {
    await expect(managingFacet.connect(nonOwner).setNftFee(100)).to.be.revertedWith('LibDiamond: Must be contract owner');
  });
});
