import { assert, expect } from 'chai';
import { BigNumber, Signer } from 'ethers';
import { ethers, network } from 'hardhat';

import { deployAll } from '../scripts/deploy/index';
import {
  AMMFacet,
  Diamond,
  DistributionFacet,
  ListingFacet,
  ManagingFacet,
  ERC20Mock,
  ERC721Mock,
} from '../typechain';

import { TradingHelper, mintNft, tenPercent, dummyIpfsHash, listingPrice } from './testUtils';

const oneEther: BigNumber = BigNumber.from(10).pow(18);
const rewardParameter = 2;
const rewardEpoch = 10;
const gasReward = oneEther;
const initialRounds = 100;

async function skipBlocks(n: number) {
  for (let i = 0; i < n; i++) {
    await network.provider.send('evm_mine');
  }
}

function assertAlmostEqual(v1: BigNumber, v2: BigNumber) {
  // console.log(v1)
  // console.log(v2)
  // console.log("------------")
  let min = v1;
  let max = v2;
  if (v1.gt(v2)) {
    min = v2;
    max = v1;
  }
  assert(max.sub(min).mul(100000000).lt(min));
}

function calculateRewardAmount(
  minPairBaseReserve: BigNumber,
  tradingVolume: BigNumber,
  minRoundReserve: number,
  totalMintedRounds: number,
  addGasReward: boolean = false,
) {
  return minPairBaseReserve
    .mul(tradingVolume)
    .div(rewardParameter)
    .mul(minRoundReserve)
    .div(initialRounds + totalMintedRounds)
    .div(oneEther)
    .add(addGasReward ? gasReward : 0);
}

describe('Distribution', function () {
  let owner: Signer;
  let trader0: Signer;
  let trader1: Signer;

  // let ownerAddress: string;
  let trader0Address: string;
  let trader1Address: string;

  let testERC20: ERC20Mock;
  let testERC721: ERC721Mock;
  let nftId0: BigNumber;
  let nftId1: BigNumber;

  let core: Diamond;

  let ammFacet: AMMFacet;
  let listingFacet: ListingFacet;
  // let viewFacet: ViewFacet;
  let distributionFacet: DistributionFacet;
  let managingFacet: ManagingFacet;

  this.beforeEach(async function () {
    ({ core } = await deployAll());

    ammFacet = await ethers.getContractAt('AMMFacet', core.address);
    listingFacet = await ethers.getContractAt('ListingFacet', core.address);
    // viewFacet = await ethers.getContractAt("ViewFacet", core.address);
    distributionFacet = await ethers.getContractAt(
      'DistributionFacet',
      core.address,
    );
    managingFacet = await ethers.getContractAt('ManagingFacet', core.address);

    [owner, trader0, trader1] = await ethers.getSigners();
    // ownerAddress = await owner.getAddress();
    trader0Address = await trader0.getAddress();
    trader1Address = await trader1.getAddress();

    testERC20 = await (
      await ethers.getContractFactory('ERC20Mock')
    ).deploy('TestERC20', 'TERC20', oneEther.mul(1_000_000));
    testERC721 = await (await ethers.getContractFactory('ERC721Mock')).deploy('TestERC721', 'TERC721');

    nftId0 = await mintNft(testERC721, owner);
    nftId1 = await mintNft(testERC721, owner);

    await testERC721.connect(owner).approve(core.address, nftId0);
    await testERC721.connect(owner).approve(core.address, nftId1);

    await testERC20.transfer(trader0Address, oneEther.mul(10000));
    await testERC20.transfer(trader1Address, oneEther.mul(10000));
  });

  it('Test creating distribution pools', async function (): Promise<void> {
    // Can not list pairs without the base token's distribution pool
    await expect(
      listingFacet.list(testERC721.address, nftId0, 1, testERC20.address, [
        'tag0',
        'tag1',
      ], dummyIpfsHash),
    ).to.be.revertedWith('Pilgrim: INVALID_BASE_TOKEN');

    // Only the contract owner can create a distribution pool
    await expect(
      managingFacet
        .connect(trader0)
        .createPool(testERC20.address, rewardParameter, oneEther),
    ).to.be.revertedWith('LibDiamond: Must be contract owner');

    await managingFacet.createPool(
      testERC20.address,
      rewardParameter,
      oneEther,
    );

    // Check the rewardParameter
    const distPoolInfo = await distributionFacet.getDistPoolInfo(
      testERC20.address,
    );
    expect(distPoolInfo._rewardParameter).to.equal(rewardParameter);
    expect(distPoolInfo._gasReward).to.equal(gasReward);

    // Now we can list a NFT
    listingFacet.list(testERC721.address, nftId0, 1, testERC20.address, [
      'tag0',
    ], dummyIpfsHash);
  });

  it('Test managing distribution pools', async function (): Promise<void> {
    await managingFacet.createPool(
      testERC20.address,
      rewardParameter,
      oneEther,
    );

    // Only the contract owner can update rewardEpoch
    await expect(
      managingFacet.connect(trader0).setRewardEpoch(7200),
    ).to.be.revertedWith('LibDiamond: Must be contract owner');

    // Only the contract owner can update the rewardParameter
    await expect(
      managingFacet
        .connect(trader0)
        .setRewardParameter(testERC20.address, oneEther.mul(2)),
    ).to.be.revertedWith('LibDiamond: Must be contract owner');

    // Only the contract owner can halve rewards
    await expect(
      managingFacet.connect(trader0).halveRewards(),
    ).to.be.revertedWith('LibDiamond: Must be contract owner');

    // Only the contract owner can update the gasReward
    await expect(
      managingFacet
        .connect(trader0)
        .setGasReward(testERC20.address, oneEther.mul(2)),
    ).to.be.revertedWith('LibDiamond: Must be contract owner');

    await managingFacet.setRewardEpoch(7200);
    expect(await distributionFacet.getRewardEpoch()).to.equal(7200);

    await managingFacet.setRewardParameter(testERC20.address, oneEther.mul(2));
    expect(
      await (
        await distributionFacet.getDistPoolInfo(testERC20.address)
      )._rewardParameter,
    ).to.equal(oneEther.mul(2));

    await managingFacet.halveRewards();
    expect(
      await (
        await distributionFacet.getDistPoolInfo(testERC20.address)
      )._rewardParameter,
    ).to.equal(oneEther.mul(4));

    await managingFacet.setGasReward(testERC20.address, oneEther.mul(2));
    expect(
      await (
        await distributionFacet.getDistPoolInfo(testERC20.address)
      )._gasReward,
    ).to.equal(oneEther.mul(2));
  });

  it.skip('Test reward calculation - single pair & single user', async function (): Promise<void> {
    await managingFacet.createPool(
      testERC20.address,
      rewardParameter,
      gasReward,
    );
    await managingFacet.setRewardEpoch(rewardEpoch);
    listingFacet.list(testERC721.address, nftId0, listingPrice, testERC20.address, [
      'tag0',
    ], dummyIpfsHash);

    const metaNftId = 0;

    const tradingHelper = new TradingHelper(
      ammFacet,
      metaNftId,
      trader0,
      testERC20,
    );

    // ------------------ epoch 0 -------------------
    // buy 10 rounds
    const baseIn0 = await tradingHelper.buyRounds(tenPercent);
    // sell 5 rounds
    const baseOut0 = await tradingHelper.sellRounds(tenPercent.div(2));

    // rewards are not calculated yet
    expect(await distributionFacet.getPairReward(metaNftId)).to.equal(0);
    expect(await distributionFacet.getUserReward(trader0Address)).to.equal(0);

    await skipBlocks(rewardEpoch);

    const epoch0MinRoundReserve = baseIn0.sub(baseOut0);
    const epoch0TradingVolume = baseIn0.add(baseOut0);

    // ------------------- epoch 1 ------------------
    // buy 10 rounds => trigger epoch 0 reward calculation
    const baseIn1 = await tradingHelper.buyRounds(tenPercent);

    // check epoch 0 rewards
    const pairReward0 = await distributionFacet.getPairReward(metaNftId);
    const userReward0 = await distributionFacet.getUserReward(trader0Address);

    assertAlmostEqual(
      pairReward0,
      calculateRewardAmount(
        epoch0MinRoundReserve,
        epoch0TradingVolume,
        initialRounds,
        5,
      ),
    );

    assertAlmostEqual(
      userReward0,
      calculateRewardAmount(
        epoch0MinRoundReserve,
        epoch0TradingVolume,
        5,
        5,
        true,
      ),
    );

    // buy 10 reounds
    const baseIn2 = await tradingHelper.buyRounds(tenPercent);

    // rewards are not calculated yet
    expect(await distributionFacet.getPairReward(0)).to.equal(pairReward0);
    expect(await distributionFacet.getUserReward(trader0Address)).to.equal(
      userReward0,
    );

    await skipBlocks(rewardEpoch);

    const epoch1MinRoundReserve = baseIn0.sub(baseOut0).add(baseIn1);
    const epoch1TradingVolume = baseIn1.add(baseIn2);

    // ------------------- epoch 2 ------------------
    // sell 10 rounds => trigger epoch 1 reward calculation
    await tradingHelper.sellRounds(tenPercent);

    // check epoch 1 rewards
    const pairReward1 = await distributionFacet.getPairReward(metaNftId);
    const userReward1 = await distributionFacet.getUserReward(trader0Address);

    assertAlmostEqual(
      pairReward1,
      pairReward0.add(
        calculateRewardAmount(
          epoch1MinRoundReserve,
          epoch1TradingVolume,
          initialRounds,
          25,
        ),
      ),
    );

    assertAlmostEqual(
      userReward1,
      userReward0.add(
        calculateRewardAmount(
          epoch1MinRoundReserve,
          epoch1TradingVolume,
          15,
          25,
          true,
        ),
      ),
    );
  });

  it.skip('Test reward calculation - single pair & multi user', async function (): Promise<void> {
    await managingFacet.createPool(
      testERC20.address,
      rewardParameter,
      gasReward,
    );
    await managingFacet.setRewardEpoch(rewardEpoch);

    listingFacet.list(testERC721.address, nftId0, listingPrice, testERC20.address, [
      'tag0',
    ], dummyIpfsHash);

    const metaNftId = 0;

    const tradingHelper0 = new TradingHelper(
      ammFacet,
      metaNftId,
      trader0,
      testERC20,
    );
    const tradingHelper1 = new TradingHelper(
      ammFacet,
      metaNftId,
      trader1,
      testERC20,
    );

    // ------------------ epoch 0 -------------------
    // trader0: buy 10
    const baseIn0 = await tradingHelper0.buyRounds(tenPercent);
    // trader0: sell 5 rounds
    const baseOut0 = await tradingHelper0.sellRounds(tenPercent.div(2));
    // trader1: buy 10 rounds
    const baseIn1 = await tradingHelper1.buyRounds(tenPercent);

    // rewards are not calculated yet
    expect(await distributionFacet.getPairReward(metaNftId)).to.equal(0);
    expect(await distributionFacet.getUserReward(trader0Address)).to.equal(0);
    expect(await distributionFacet.getUserReward(trader1Address)).to.equal(0);

    await skipBlocks(rewardEpoch);

    const epoch0MinRoundReserve = baseIn0.sub(baseOut0);
    const epoch0TradingVolume = baseIn0.add(baseOut0).add(baseIn1);

    // ------------------- epoch 1 ------------------
    // trader0: buy 10 rounds => trigger trader0's epoch 0 reward calculation
    const baseIn2 = await tradingHelper0.buyRounds(tenPercent);

    // check epoch 0 rewards
    const pairReward0 = await distributionFacet.getPairReward(metaNftId);
    const user0Reward0 = await distributionFacet.getUserReward(trader0Address);

    assertAlmostEqual(
      pairReward0,
      calculateRewardAmount(
        epoch0MinRoundReserve,
        epoch0TradingVolume,
        initialRounds,
        15,
      ),
    );
    assertAlmostEqual(
      user0Reward0,
      calculateRewardAmount(
        epoch0MinRoundReserve,
        epoch0TradingVolume,
        5,
        15,
        true,
      ),
    );
    expect(await distributionFacet.getUserReward(trader1Address)).to.equal(0);

    // trader0: buy 10 rounds
    const baseIn3 = await tradingHelper0.buyRounds(tenPercent);

    // rewards are not calculated yet
    expect(await distributionFacet.getPairReward(metaNftId)).to.equal(
      pairReward0,
    );
    expect(await distributionFacet.getUserReward(trader0Address)).to.equal(
      user0Reward0,
    );
    expect(await distributionFacet.getUserReward(trader1Address)).to.equal(0);

    await skipBlocks(rewardEpoch);

    const epoch1MinRoundReserve = baseIn0
      .sub(baseOut0)
      .add(baseIn1)
      .add(baseIn2);
    const epoch1TradingVolume = baseIn2.add(baseIn3);

    // ------------------- epoch 2 ------------------
    // trader0: sell 10 rounds => trigger trader0's epoch 1 reward calculation
    await tradingHelper0.sellRounds(tenPercent);

    // check epoch 1 rewards
    const pairReward1 = await distributionFacet.getPairReward(metaNftId);
    const user0Reward1 = await distributionFacet.getUserReward(trader0Address);

    assertAlmostEqual(
      pairReward1,
      pairReward0.add(
        calculateRewardAmount(
          epoch1MinRoundReserve,
          epoch1TradingVolume,
          initialRounds,
          35,
        ),
      ),
    );
    assertAlmostEqual(
      user0Reward1,
      user0Reward0.add(
        calculateRewardAmount(
          epoch1MinRoundReserve,
          epoch1TradingVolume,
          15,
          35,
          true,
        ),
      ),
    );
    expect(await distributionFacet.getUserReward(trader1Address)).to.equal(0);

    // trader1: sell 10 rounds => trigger trader1's epoch 0~1 reward calculation
    await tradingHelper1.sellRounds(tenPercent);
    expect(await distributionFacet.getPairReward(metaNftId)).to.equal(
      pairReward1,
    );
    expect(await distributionFacet.getUserReward(trader0Address)).to.equal(
      user0Reward1,
    );
    assertAlmostEqual(
      await distributionFacet.getUserReward(trader1Address),
      calculateRewardAmount(
        epoch0MinRoundReserve,
        epoch0TradingVolume,
        10,
        15,
      ).add(
        calculateRewardAmount(
          epoch1MinRoundReserve,
          epoch1TradingVolume,
          10,
          35,
        ),
      ),
    );
  });

  it.skip('Test reward calculation - multi pair & single user', async function (): Promise<void> {
    await managingFacet.createPool(
      testERC20.address,
      rewardParameter,
      oneEther,
    );
    await managingFacet.setRewardEpoch(rewardEpoch);

    listingFacet.list(testERC721.address, nftId0, listingPrice, testERC20.address, [
      'tag0',
    ], dummyIpfsHash);
    listingFacet.list(
      testERC721.address,
      nftId1,
      oneEther.mul(2),
      testERC20.address,
      ['tag0'],
      dummyIpfsHash,
    );

    const metaNftId0 = 0;
    const metaNftId1 = 1;

    const tradingHelper0 = new TradingHelper(
      ammFacet,
      metaNftId0,
      trader0,
      testERC20,
    );
    const tradingHelper1 = new TradingHelper(
      ammFacet,
      metaNftId1,
      trader0,
      testERC20,
    );

    // ------------------ epoch 0 -------------------
    // pair0: buy 10 rounds
    const baseIn0 = await tradingHelper0.buyRounds(tenPercent);
    expect(await distributionFacet.getPairReward(metaNftId0)).to.equal(0);
    expect(await distributionFacet.getPairReward(metaNftId1)).to.equal(0);
    expect(await distributionFacet.getUserReward(trader0Address)).to.equal(0);

    await skipBlocks(rewardEpoch);

    const pair0MinRoundReserve = baseIn0;
    const pair0TradingVolume = baseIn0;

    // ------------------ epoch 1 -------------------
    // pair1: buy 20 rounds
    const baseIn1 = await tradingHelper1.buyRounds(tenPercent.mul(2));
    expect(await distributionFacet.getPairReward(metaNftId0)).to.equal(0);
    expect(await distributionFacet.getPairReward(metaNftId1)).to.equal(0);
    expect(await distributionFacet.getUserReward(trader0Address)).to.equal(0);

    await skipBlocks(rewardEpoch);

    const pair1MinRoundReserve = baseIn1;
    const pair1TradingVolume = baseIn1;

    // ------------------ epoch 2 -------------------
    // pair0: buy 10 rounds => trigger pair0's epoch 0~1 reward calculation
    await tradingHelper0.buyRounds(tenPercent);
    expect(await distributionFacet.getPairReward(metaNftId1)).to.equal(0);
    const pair0Reward0 = await distributionFacet.getPairReward(metaNftId0);
    const userReward0 = await distributionFacet.getUserReward(trader0Address);
    assertAlmostEqual(
      pair0Reward0,
      calculateRewardAmount(
        pair0MinRoundReserve,
        pair0TradingVolume,
        initialRounds,
        10,
      ),
    );
    assertAlmostEqual(
      userReward0,
      calculateRewardAmount(
        pair0MinRoundReserve,
        pair0TradingVolume,
        10,
        10,
        true,
      ),
    );

    await skipBlocks(rewardEpoch);

    // ------------------ epoch 3 -------------------
    // pair1: buy 10 rounds => trigger pair1's epoch 1~2 reward calculation
    await tradingHelper1.buyRounds(tenPercent);
    expect(await distributionFacet.getPairReward(metaNftId0)).to.equal(
      pair0Reward0,
    );
    assertAlmostEqual(
      await distributionFacet.getPairReward(metaNftId1),
      calculateRewardAmount(
        pair1MinRoundReserve,
        pair1TradingVolume,
        initialRounds,
        20,
      ),
    );
    assertAlmostEqual(
      await distributionFacet.getUserReward(trader0Address),
      userReward0.add(
        calculateRewardAmount(
          pair1MinRoundReserve,
          pair1TradingVolume,
          20,
          20,
          true,
        ),
      ),
    );
  });
});
