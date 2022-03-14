import { expect } from 'chai';
import { BigNumber, constants, Signer } from 'ethers';
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
  NonfungiblePositionManager,
  PilgrimToken, TestUniswapV3Callee,
  UniswapV3Factory,
  UniswapV3Pool__factory,
  ViewFacet,
} from '../../typechain';
import {
  afterBaseFee,
  afterRoundFee,
  assertAlmostEqual,
  beforeBaseFee,
  beforeRoundFee,
  billionEther,
  deadline,
  DistributionHelper,
  dummyIpfsHash,
  getEventArgs,
  hundredPercent, initialEtherRounds,
  listingPrice,
  mintNft,
  oneEther,
  runRWMethod,
  skipBlocks,
  sortTokenAddrs,
  TokenPrice,
  TradingHelper,
} from '../testUtils';
import { FeeAmount, encodePriceSqrt, TICK_SPACINGS, getMinTick, getMaxTick } from '../uniswap/testUtils';

describe('Distribution Scenario - DIST_1', function () {
  let admin: Signer;
  let pairOwner: Signer;
  let lister: Signer;
  let trader1: Signer;
  let trader2: Signer;

  let adminAddr: string;
  let pairOwnerAddr: string;
  let listerAddr: string;
  let trader1Addr: string;
  let trader2Addr: string;

  let testERC20: ERC20Mock;
  let erc721: ERC721Mock;

  let core: Diamond;
  let nfPositionManager: NonfungiblePositionManager;
  let pilgrim: PilgrimToken;
  let weth: ERC20Mock;

  let factory: UniswapV3Factory;
  let UniswapV3PoolFactory: UniswapV3Pool__factory;
  let swapTargetCallee: TestUniswapV3Callee;

  let ammFacet: AMMFacet;
  let listingFacet: ListingFacet;
  let viewFacet: ViewFacet;
  let distributionFacet: DistributionFacet;
  let managingFacet: ManagingFacet;

  let createSLP: Function;

  const rewardEpoch = 10;
  const rewardParameter = 100;
  const gasReward = oneEther.div(10);
  const initialRounds = oneEther.mul(initialEtherRounds);

  this.beforeEach(async function () {
    // @ts-ignore
    ({ core, nfPositionManager, pilgrim, weth, factory, testERC20 } = await deployAll());

    ammFacet = await ethers.getContractAt('AMMFacet', core.address);
    listingFacet = await ethers.getContractAt('ListingFacet', core.address);
    viewFacet = await ethers.getContractAt('ViewFacet', core.address);
    distributionFacet = await ethers.getContractAt('DistributionFacet', core.address);
    managingFacet = await ethers.getContractAt('ManagingFacet', core.address);

    UniswapV3PoolFactory = await ethers.getContractFactory('UniswapV3Pool');
    swapTargetCallee = await (await ethers.getContractFactory('TestUniswapV3Callee')).deploy();

    [admin, pairOwner, lister, trader1, trader2] = await ethers.getSigners();
    adminAddr = await admin.getAddress();
    pairOwnerAddr = await pairOwner.getAddress();
    listerAddr = await lister.getAddress();
    trader1Addr = await trader1.getAddress();
    trader2Addr = await trader2.getAddress();

    erc721 = await (await ethers.getContractFactory('ERC721Mock')).deploy('TestERC721', 'TNFT');

    await testERC20.transfer(trader1Addr, billionEther.div(2));
    await testERC20.transfer(trader2Addr, billionEther.div(2));

    await managingFacet.createPool(
      testERC20.address,
      rewardParameter,
      gasReward,
    );

    await pilgrim.mint(billionEther);
    await pilgrim.transfer(core.address, billionEther.div(2));

    await managingFacet.setRewardEpoch(rewardEpoch);

    createSLP = async (tokenA: ERC20Mock, tokenB: ERC20Mock, reserveA: number, reserveB: number) => {
      const createPoolTx = await factory.createPool(tokenA.address, tokenB.address, FeeAmount.LOW);

      // @ts-ignore
      const event = (await createPoolTx.wait()).events[0];
      // @ts-ignore
      const poolAddress = event.args.pool;
      const pool = await UniswapV3PoolFactory.attach(poolAddress);

      // @ts-ignore
      if (event.args.token0 === tokenA.address) {
        await pool.initialize(encodePriceSqrt(reserveB, reserveA));
      } else {
        await pool.initialize(encodePriceSqrt(reserveA, reserveB));
      }

      await tokenA.approve(swapTargetCallee.address, constants.MaxUint256);
      await tokenB.approve(swapTargetCallee.address, constants.MaxUint256);
      const tickSpacing = TICK_SPACINGS[FeeAmount.LOW];
      await swapTargetCallee.mint(pool.address, adminAddr, getMinTick(tickSpacing), getMaxTick(tickSpacing), oneEther);
      return pool;
    };
  });

  async function DIST01(
    nftAddr: string,
    nftId: BigNumber,
    triggerByBuy: boolean,
    extraRewardParam: number = 1,
    baseToken: ERC20Mock = testERC20,
    baseTokenPrice: TokenPrice | null = null,
  ) {
    const distHelper = new DistributionHelper(
      rewardParameter,
      gasReward,
      initialRounds,
      extraRewardParam,
      baseTokenPrice,
    );

    const listResult = await runRWMethod({
      method: listingFacet
        .connect(lister)
        .list(nftAddr, nftId, listingPrice, baseToken.address, [], dummyIpfsHash),
      name: 'List',
    });
    const metaNftId = listResult._metaNftId;

    const tradingHelper = new TradingHelper(ammFacet, metaNftId, trader1, baseToken);

    const roundOut = BigNumber.from(Math.floor(Math.random() * 1000)).mul(oneEther);
    const baseIn = await tradingHelper.buyRounds(roundOut);

    expect(await distributionFacet.getPairReward(metaNftId)).to.equal(0);
    expect(await distributionFacet.getUserReward(trader1Addr)).to.equal(0);

    const epochMinPairBaseReserve = afterBaseFee(baseIn, false);
    const epochPairTradingVolume = baseIn;
    const epochMinUserRoundReserve = roundOut;
    const epochMintedRounds = beforeRoundFee(roundOut);

    await skipBlocks(rewardEpoch);

    if (triggerByBuy) {
      await tradingHelper.buyRounds(roundOut, true);
    } else {
      await tradingHelper.sellRounds(roundOut, true);
    }

    const pairReward = await distributionFacet.getPairReward(metaNftId);
    const userReward = await distributionFacet.getUserReward(trader1Addr);

    assertAlmostEqual(
      pairReward,
      distHelper.calculateReward(
        epochMinPairBaseReserve,
        epochPairTradingVolume,
        initialRounds,
        epochMintedRounds,
      ),
    );

    assertAlmostEqual(
      userReward,
      distHelper.calculateReward(
        epochMinPairBaseReserve,
        epochPairTradingVolume,
        epochMinUserRoundReserve,
        epochMintedRounds,
        true,
      ),
    );

    const beforeListerReserve = await pilgrim.balanceOf(listerAddr);
    await runRWMethod({
      method: distributionFacet.claimPairReward(metaNftId),
      name: 'ClaimPairReward',
      expectedArgs: { _metaNftId: metaNftId, _amount: pairReward },
    });
    expect((await pilgrim.balanceOf(listerAddr)).sub(beforeListerReserve)).to.equal(pairReward);

    const beforeTraderReserve = await pilgrim.balanceOf(trader1Addr);
    await runRWMethod({
      method: distributionFacet.connect(trader1).claimUserReward(),
      name: 'ClaimUserReward',
      expectedArgs: { _userAddress: trader1Addr, _amount: userReward },
    });
    expect((await pilgrim.balanceOf(trader1Addr)).sub(beforeTraderReserve)).to.equal(userReward);
  }

  it('DIST_0101', async function (): Promise<void> {
    const nftId = await mintNft(erc721, lister);
    await erc721.connect(lister).approve(listingFacet.address, nftId);
    await DIST01(erc721.address, nftId, true);
  });

  // Trigger reward calculation by sell
  it('DIST_0102', async function (): Promise<void> {
    const nftId = await mintNft(erc721, lister);
    await erc721.connect(lister).approve(listingFacet.address, nftId);
    await DIST01(erc721.address, nftId, false);
  });

  // UniV3Pos PIL-ETH
  it('DIST_0103', async function (): Promise<void> {
    await pilgrim.transfer(listerAddr, hundredPercent);
    await pilgrim.connect(lister).approve(nfPositionManager.address, hundredPercent);
    await weth.transfer(listerAddr, hundredPercent);
    await weth.connect(lister).approve(nfPositionManager.address, hundredPercent);

    const [token0, token1] = sortTokenAddrs(pilgrim.address, weth.address);
    const mintReceipt = await (await nfPositionManager.connect(lister).mint({
      token0,
      token1,
      fee: FeeAmount.LOW,
      tickLower: getMinTick(TICK_SPACINGS[FeeAmount.LOW]),
      tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.LOW]),
      amount0Desired: oneEther,
      amount1Desired: oneEther,
      amount0Min: oneEther,
      amount1Min: oneEther,
      recipient: listerAddr,
      deadline,
    })).wait();

    const { tokenId } = getEventArgs(mintReceipt, 'IncreaseLiquidity');

    await nfPositionManager.connect(lister).approve(core.address, tokenId);

    const extraRewardParam = 5;
    await managingFacet.setUniV3ExtraRewardParam(pilgrim.address, weth.address, extraRewardParam);
    await DIST01(nfPositionManager.address, tokenId, true, extraRewardParam);
  });

  // base token price < ether
  it('DIST_0104', async function (): Promise<void> {
    const nftId = await mintNft(erc721, lister);
    await erc721.connect(lister).approve(listingFacet.address, nftId);

    const newToken = await (await ethers.getContractFactory('ERC20Mock')).deploy('NewToken', 'NEW', billionEther);
    createSLP(newToken, weth, 242513, 14243);
    await newToken.transfer(trader1Addr, billionEther.div(3));
    await newToken.transfer(trader2Addr, billionEther.div(3));

    managingFacet.createPool(newToken.address, rewardParameter, gasReward);

    const tokenPrice = {
      numerator: 14243,
      denominator: 242513,
    };

    await DIST01(erc721.address, nftId, true, 1, newToken, tokenPrice);
  });

  // base token price > ether
  it('DIST_0105', async function (): Promise<void> {
    const nftId = await mintNft(erc721, lister);
    await erc721.connect(lister).approve(listingFacet.address, nftId);

    const newToken = await (await ethers.getContractFactory('ERC20Mock')).deploy('NewToken', 'NEW', billionEther);
    createSLP(newToken, weth, 423561, 1301232);
    await newToken.transfer(trader1Addr, billionEther.div(3));
    await newToken.transfer(trader2Addr, billionEther.div(3));

    managingFacet.createPool(newToken.address, rewardParameter, gasReward);

    const tokenPrice = {
      numerator: 1301232,
      denominator: 423561,
    };

    await DIST01(erc721.address, nftId, true, 1, newToken, tokenPrice);
  });

  async function DIST02(nftAddr: string, nftId: BigNumber, extraRewardParam: number = 1) {
    const distHelper = new DistributionHelper(
      rewardParameter,
      gasReward,
      initialRounds,
      extraRewardParam,
    );

    const listResult = await runRWMethod({
      method: listingFacet
        .connect(lister)
        .list(nftAddr, nftId, listingPrice, testERC20.address, [], dummyIpfsHash),
      name: 'List',
    });
    const metaNftId = listResult._metaNftId;

    const tradingHelper = new TradingHelper(ammFacet, metaNftId, trader1, testERC20);

    const roundOut = BigNumber.from(Math.floor(Math.random() * 1000)).mul(oneEther);
    const baseIn1 = await tradingHelper.buyRounds(roundOut);

    const roundIn = roundOut.div(2);
    const baseOut = await tradingHelper.sellRounds(roundIn);

    const baseIn2 = await tradingHelper.buyRounds(roundOut);

    expect(await distributionFacet.getPairReward(metaNftId)).to.equal(0);
    expect(await distributionFacet.getUserReward(trader1Addr)).to.equal(0);

    const epochMinPairBaseReserve = afterBaseFee(baseIn1, false).sub(beforeBaseFee(baseOut, false));
    const epochPairTradingVolume = baseIn1.add(baseOut).add(baseIn2);
    const epochMinUserRoundReserve = roundOut.sub(roundIn);
    const epochMintedRounds = beforeRoundFee(roundOut).sub(afterRoundFee(roundIn)).add(beforeRoundFee(roundOut));

    await skipBlocks(rewardEpoch);

    await tradingHelper.buyRounds(roundOut, true);

    const pairReward = await distributionFacet.getPairReward(metaNftId);
    const userReward = await distributionFacet.getUserReward(trader1Addr);

    assertAlmostEqual(
      pairReward,
      distHelper.calculateReward(
        epochMinPairBaseReserve,
        epochPairTradingVolume,
        initialRounds,
        epochMintedRounds,
      ),
    );

    assertAlmostEqual(
      userReward,
      distHelper.calculateReward(
        epochMinPairBaseReserve,
        epochPairTradingVolume,
        epochMinUserRoundReserve,
        epochMintedRounds,
        true,
      ),
    );

    const beforeListerReserve = await pilgrim.balanceOf(listerAddr);
    await runRWMethod({
      method: distributionFacet.claimPairReward(metaNftId),
      name: 'ClaimPairReward',
      expectedArgs: { _metaNftId: metaNftId, _amount: pairReward },
    });
    expect((await pilgrim.balanceOf(listerAddr)).sub(beforeListerReserve)).to.equal(pairReward);

    const beforeTraderReserve = await pilgrim.balanceOf(trader1Addr);
    await runRWMethod({
      method: distributionFacet.connect(trader1).claimUserReward(),
      name: 'ClaimUserReward',
      expectedArgs: { _userAddress: trader1Addr, _amount: userReward },
    });
    expect((await pilgrim.balanceOf(trader1Addr)).sub(beforeTraderReserve)).to.equal(userReward);
  }

  it('DIST_0201', async function (): Promise<void> {
    const nftId = await mintNft(erc721, lister);
    await erc721.connect(lister).approve(listingFacet.address, nftId);
    await DIST02(erc721.address, nftId);
  });

  // UniV3Pos PIL-ETH
  it('DIST_0202', async function (): Promise<void> {
    await pilgrim.transfer(listerAddr, hundredPercent);
    await pilgrim.connect(lister).approve(nfPositionManager.address, hundredPercent);
    await weth.transfer(listerAddr, hundredPercent);
    await weth.connect(lister).approve(nfPositionManager.address, hundredPercent);

    const [token0, token1] = sortTokenAddrs(pilgrim.address, weth.address);
    const mintReceipt = await (await nfPositionManager.connect(lister).mint({
      token0,
      token1,
      fee: FeeAmount.LOW,
      tickLower: getMinTick(TICK_SPACINGS[FeeAmount.LOW]),
      tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.LOW]),
      amount0Desired: oneEther,
      amount1Desired: oneEther,
      amount0Min: oneEther,
      amount1Min: oneEther,
      recipient: listerAddr,
      deadline,
    })).wait();

    const { tokenId } = getEventArgs(mintReceipt, 'IncreaseLiquidity');

    await nfPositionManager.connect(lister).approve(core.address, tokenId);

    const extraRewardParam = 5;
    await managingFacet.setUniV3ExtraRewardParam(pilgrim.address, weth.address, extraRewardParam);
    await DIST02(nfPositionManager.address, tokenId, extraRewardParam);
  });

  async function DIST03(nftAddr: string, nftId: BigNumber, extraRewardParam: number = 1) {
    const distHelper = new DistributionHelper(
      rewardParameter,
      gasReward,
      initialRounds,
      extraRewardParam,
    );

    const listResult = await runRWMethod({
      method: listingFacet
        .connect(lister)
        .list(nftAddr, nftId, listingPrice, testERC20.address, [], dummyIpfsHash),
      name: 'List',
    });
    const metaNftId = listResult._metaNftId;

    const tradingHelper1 = new TradingHelper(ammFacet, metaNftId, trader1, testERC20);
    const tradingHelper2 = new TradingHelper(ammFacet, metaNftId, trader2, testERC20);

    const roundOut1 = BigNumber.from(Math.floor(Math.random() * 1000)).mul(oneEther);
    const baseIn1 = await tradingHelper1.buyRounds(roundOut1);

    const roundOut2 = roundOut1.mul(2);
    const baseIn2 = await tradingHelper2.buyRounds(roundOut2);

    const roundIn1 = roundOut1.div(2);
    const baseOut1 = await tradingHelper1.sellRounds(roundIn1);

    expect(await distributionFacet.getPairReward(metaNftId)).to.equal(0);
    expect(await distributionFacet.getUserReward(trader1Addr)).to.equal(0);
    expect(await distributionFacet.getUserReward(trader2Addr)).to.equal(0);

    const epochMinPairBaseReserve = afterBaseFee(baseIn1, false);
    const epochPairTradingVolume = baseIn1.add(baseIn2).add(baseOut1);
    const epochMinUser1RoundReserve = roundOut1.sub(roundIn1);
    const epochMinUser2RoundReserve = roundOut2;
    const epochMintedRounds = beforeRoundFee(roundOut1).add(beforeRoundFee(roundOut2)).sub(afterRoundFee(roundIn1));

    await skipBlocks(rewardEpoch);

    await tradingHelper1.buyRounds(roundOut1, true);

    const pairReward = await distributionFacet.getPairReward(metaNftId);
    const user1Reward = await distributionFacet.getUserReward(trader1Addr);

    assertAlmostEqual(
      pairReward,
      distHelper.calculateReward(
        epochMinPairBaseReserve,
        epochPairTradingVolume,
        initialRounds,
        epochMintedRounds,
      ),
    );

    assertAlmostEqual(
      user1Reward,
      distHelper.calculateReward(
        epochMinPairBaseReserve,
        epochPairTradingVolume,
        epochMinUser1RoundReserve,
        epochMintedRounds,
        true,
      ),
    );

    await tradingHelper2.buyRounds(roundOut2);

    const user2Reward = await distributionFacet.getUserReward(trader2Addr);

    assertAlmostEqual(
      user2Reward,
      distHelper.calculateReward(
        epochMinPairBaseReserve,
        epochPairTradingVolume,
        epochMinUser2RoundReserve,
        epochMintedRounds,
      ),
    );

    const beforeListerReserve = await pilgrim.balanceOf(listerAddr);
    await runRWMethod({
      method: distributionFacet.claimPairReward(metaNftId),
      name: 'ClaimPairReward',
      expectedArgs: { _metaNftId: metaNftId, _amount: pairReward },
    });
    expect((await pilgrim.balanceOf(listerAddr)).sub(beforeListerReserve)).to.equal(pairReward);

    const beforeTrader1Reserve = await pilgrim.balanceOf(trader1Addr);
    await runRWMethod({
      method: distributionFacet.connect(trader1).claimUserReward(),
      name: 'ClaimUserReward',
      expectedArgs: { _userAddress: trader1Addr, _amount: user1Reward },
    });
    expect((await pilgrim.balanceOf(trader1Addr)).sub(beforeTrader1Reserve)).to.equal(user1Reward);

    const beforeTrader2Reserve = await pilgrim.balanceOf(trader2Addr);
    await runRWMethod({
      method: distributionFacet.connect(trader2).claimUserReward(),
      name: 'ClaimUserReward',
      expectedArgs: { _userAddress: trader2Addr, _amount: user2Reward },
    });
    expect((await pilgrim.balanceOf(trader2Addr)).sub(beforeTrader2Reserve)).to.equal(user2Reward);
  }

  it('DIST_0301', async function (): Promise<void> {
    const nftId = await mintNft(erc721, lister);
    await erc721.connect(lister).approve(listingFacet.address, nftId);
    await DIST03(erc721.address, nftId);
  });

  // UniV3Pos PIL-ETH
  it('DIST_0302', async function (): Promise<void> {
    await pilgrim.transfer(listerAddr, hundredPercent);
    await pilgrim.connect(lister).approve(nfPositionManager.address, hundredPercent);
    await weth.transfer(listerAddr, hundredPercent);
    await weth.connect(lister).approve(nfPositionManager.address, hundredPercent);

    const [token0, token1] = sortTokenAddrs(pilgrim.address, weth.address);
    const mintReceipt = await (await nfPositionManager.connect(lister).mint({
      token0,
      token1,
      fee: FeeAmount.LOW,
      tickLower: getMinTick(TICK_SPACINGS[FeeAmount.LOW]),
      tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.LOW]),
      amount0Desired: oneEther,
      amount1Desired: oneEther,
      amount0Min: oneEther,
      amount1Min: oneEther,
      recipient: listerAddr,
      deadline,
    })).wait();

    const { tokenId } = getEventArgs(mintReceipt, 'IncreaseLiquidity');

    await nfPositionManager.connect(lister).approve(core.address, tokenId);

    const extraRewardParam = 5;
    await managingFacet.setUniV3ExtraRewardParam(pilgrim.address, weth.address, extraRewardParam);
    await DIST03(nfPositionManager.address, tokenId, extraRewardParam);
  });

  async function DIST04(
    nftAddr: string,
    nftId1: BigNumber,
    nftId2: BigNumber,
    extraRewardParam: number = 1,
  ) {
    const distHelper = new DistributionHelper(
      rewardParameter,
      gasReward,
      initialRounds,
      extraRewardParam,
    );

    const listResult1 = await runRWMethod({
      method: listingFacet
        .connect(lister)
        .list(nftAddr, nftId1, listingPrice, testERC20.address, [], dummyIpfsHash),
      name: 'List',
    });
    const metaNftId1 = listResult1._metaNftId;

    const listResult2 = await runRWMethod({
      method: listingFacet
        .connect(lister)
        .list(nftAddr, nftId2, listingPrice, testERC20.address, [], dummyIpfsHash),
      name: 'List',
    });
    const metaNftId2 = listResult2._metaNftId;

    const tradingHelper1 = new TradingHelper(ammFacet, metaNftId1, trader1, testERC20);
    const tradingHelper2 = new TradingHelper(ammFacet, metaNftId2, trader1, testERC20);

    const roundOut1 = BigNumber.from(Math.floor(Math.random() * 1000)).mul(oneEther);
    const baseIn1 = await tradingHelper1.buyRounds(roundOut1);

    const roundOut2 = BigNumber.from(Math.floor(Math.random() * 1000)).mul(oneEther);
    const baseIn2 = await tradingHelper2.buyRounds(roundOut2);

    const roundIn = roundOut1.div(2);
    const baseOut = await tradingHelper1.sellRounds(roundIn);

    expect(await distributionFacet.getPairReward(metaNftId1)).to.equal(0);
    expect(await distributionFacet.getPairReward(metaNftId2)).to.equal(0);
    expect(await distributionFacet.getUserReward(trader1Addr)).to.equal(0);

    const epochMinPair1BaseReserve = afterBaseFee(baseIn1, false).sub(beforeBaseFee(baseOut, false));
    const epochPair1TradingVolume = baseIn1.add(baseOut);
    const epochMinUserRoundReserve1 = roundOut1.sub(roundIn);
    const epochMintedRounds1 = beforeRoundFee(roundOut1).sub(afterRoundFee(roundIn));

    const epochMinPair2BaseReserve = afterBaseFee(baseIn2, false);
    const epochPair2TradingVolume = baseIn2;
    const epochMinUserRoundReserve2 = roundOut2;
    const epochMintedRounds2 = beforeRoundFee(roundOut2);

    await skipBlocks(rewardEpoch);

    await tradingHelper1.buyRounds(roundOut1, true);
    const pair1Reward = await distributionFacet.getPairReward(metaNftId1);
    const userReward1 = await distributionFacet.getUserReward(trader1Addr);

    assertAlmostEqual(
      pair1Reward,
      distHelper.calculateReward(
        epochMinPair1BaseReserve,
        epochPair1TradingVolume,
        initialRounds,
        epochMintedRounds1,
      ),
    );

    assertAlmostEqual(
      userReward1,
      distHelper.calculateReward(
        epochMinPair1BaseReserve,
        epochPair1TradingVolume,
        epochMinUserRoundReserve1,
        epochMintedRounds1,
        true,
      ),
    );

    await tradingHelper2.buyRounds(roundOut2, true);
    const pair2Reward = await distributionFacet.getPairReward(metaNftId2);
    const userReward2 = await distributionFacet.getUserReward(trader1Addr);

    assertAlmostEqual(
      pair2Reward,
      distHelper.calculateReward(
        epochMinPair2BaseReserve,
        epochPair2TradingVolume,
        initialRounds,
        epochMintedRounds2,
      ),
    );

    assertAlmostEqual(
      userReward2,
      userReward1.add(
        distHelper.calculateReward(
          epochMinPair2BaseReserve,
          epochPair2TradingVolume,
          epochMinUserRoundReserve2,
          epochMintedRounds2,
          true,
        ),
      ),
    );

    const beforeListerReserve = await pilgrim.balanceOf(listerAddr);
    await runRWMethod({
      method: distributionFacet.claimPairReward(metaNftId1),
      name: 'ClaimPairReward',
      expectedArgs: { _metaNftId: metaNftId1, _amount: pair1Reward },
    });
    expect((await pilgrim.balanceOf(listerAddr)).sub(beforeListerReserve)).to.equal(pair1Reward);

    await runRWMethod({
      method: distributionFacet.claimPairReward(metaNftId2),
      name: 'ClaimPairReward',
      expectedArgs: { _metaNftId: metaNftId2, _amount: pair2Reward },
    });
    expect((await pilgrim.balanceOf(listerAddr)).sub(beforeListerReserve))
      .to.equal(pair1Reward.add(pair2Reward));

    const beforeTraderReserve = await pilgrim.balanceOf(trader1Addr);
    await runRWMethod({
      method: distributionFacet.connect(trader1).claimUserReward(),
      name: 'ClaimUserReward',
      expectedArgs: { _userAddress: trader1Addr, _amount: userReward2 },
    });
    expect((await pilgrim.balanceOf(trader1Addr)).sub(beforeTraderReserve)).to.equal(userReward2);
  }

  it('DIST_0401', async function (): Promise<void> {
    const nftId1 = await mintNft(erc721, lister);
    const nftId2 = await mintNft(erc721, lister);
    await erc721.connect(lister).approve(listingFacet.address, nftId1);
    await erc721.connect(lister).approve(listingFacet.address, nftId2);
    await DIST04(erc721.address, nftId1, nftId2);
  });

  // UniV3Pos PIL-ETH
  it('DIST_0402', async function (): Promise<void> {
    await pilgrim.transfer(listerAddr, hundredPercent);
    await pilgrim.connect(lister).approve(nfPositionManager.address, hundredPercent);
    await weth.transfer(listerAddr, hundredPercent);
    await weth.connect(lister).approve(nfPositionManager.address, hundredPercent);

    const [token0, token1] = sortTokenAddrs(pilgrim.address, weth.address);

    const tokenIds: Array<BigNumber> = [];

    for (let i = 0; i < 2; i++) {
      const mintReceipt = await (await nfPositionManager.connect(lister).mint({
        token0,
        token1,
        fee: FeeAmount.LOW,
        tickLower: getMinTick(TICK_SPACINGS[FeeAmount.LOW]),
        tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.LOW]),
        amount0Desired: oneEther,
        amount1Desired: oneEther,
        amount0Min: oneEther,
        amount1Min: oneEther,
        recipient: listerAddr,
        deadline,
      })).wait();

      const { tokenId } = getEventArgs(mintReceipt, 'IncreaseLiquidity');
      await nfPositionManager.connect(lister).approve(core.address, tokenId);
      tokenIds.push(tokenId);
    }

    const extraRewardParam = 5;
    await managingFacet.setUniV3ExtraRewardParam(pilgrim.address, weth.address, extraRewardParam);
    await DIST04(nfPositionManager.address, tokenIds[0], tokenIds[1], extraRewardParam);
  });

  async function DIST05(nftAddr: string, nftId: BigNumber, extraRewardParam: number = 1) {
    const distHelper = new DistributionHelper(
      rewardParameter,
      gasReward,
      initialRounds,
      extraRewardParam,
    );

    const listResult = await runRWMethod({
      method: listingFacet
        .connect(lister)
        .list(nftAddr, nftId, listingPrice, testERC20.address, [], dummyIpfsHash),
      name: 'List',
    });
    const metaNftId = listResult._metaNftId;

    const tradingHelper = new TradingHelper(ammFacet, metaNftId, trader1, testERC20);

    const roundOut1 = BigNumber.from(Math.floor(Math.random() * 1000)).mul(oneEther);
    const baseIn1 = await tradingHelper.buyRounds(roundOut1);

    expect(await distributionFacet.getPairReward(metaNftId)).to.equal(0);
    expect(await distributionFacet.getUserReward(trader1Addr)).to.equal(0);

    const epoch1MinPairBaseReserve = afterBaseFee(baseIn1, false);
    const epoch1PairTradingVolume = baseIn1;
    const epoch1MinUserRoundReserve = roundOut1;
    const epoch1MintedRounds = beforeRoundFee(roundOut1);

    await skipBlocks(rewardEpoch);

    const roundOut2 = BigNumber.from(Math.floor(Math.random() * 1000)).mul(oneEther);
    const baseIn2 = await tradingHelper.buyRounds(roundOut2);

    const epoch2MinPairBaseReserve = afterBaseFee(baseIn1, false).add(afterBaseFee(baseIn2, false));
    const epoch2PairTradingVolume = baseIn2;
    const epoch2MinUserRoundReserve = roundOut1.add(roundOut2);
    const epoch2MintedRounds = beforeRoundFee(roundOut1).add(beforeRoundFee(roundOut2));

    await skipBlocks(rewardEpoch);

    await tradingHelper.buyRounds(roundOut1, true);

    const pairReward = await distributionFacet.getPairReward(metaNftId);
    const userReward = await distributionFacet.getUserReward(trader1Addr);

    assertAlmostEqual(
      pairReward,
      distHelper.calculateReward(
        epoch1MinPairBaseReserve,
        epoch1PairTradingVolume,
        initialRounds,
        epoch1MintedRounds,
      ).add(
        distHelper.calculateReward(
          epoch2MinPairBaseReserve,
          epoch2PairTradingVolume,
          initialRounds,
          epoch2MintedRounds,
        ),
      ),
    );

    assertAlmostEqual(
      userReward,
      distHelper.calculateReward(
        epoch1MinPairBaseReserve,
        epoch1PairTradingVolume,
        epoch1MinUserRoundReserve,
        epoch1MintedRounds,
        true,
      ).add(
        distHelper.calculateReward(
          epoch2MinPairBaseReserve,
          epoch2PairTradingVolume,
          epoch2MinUserRoundReserve,
          epoch2MintedRounds,
          true,
        ),
      ),
    );

    const beforeListerReserve = await pilgrim.balanceOf(listerAddr);
    await runRWMethod({
      method: distributionFacet.claimPairReward(metaNftId),
      name: 'ClaimPairReward',
      expectedArgs: { _metaNftId: metaNftId, _amount: pairReward },
    });
    expect((await pilgrim.balanceOf(listerAddr)).sub(beforeListerReserve)).to.equal(pairReward);

    const beforeTraderReserve = await pilgrim.balanceOf(trader1Addr);
    await runRWMethod({
      method: distributionFacet.connect(trader1).claimUserReward(),
      name: 'ClaimUserReward',
      expectedArgs: { _userAddress: trader1Addr, _amount: userReward },
    });
    expect((await pilgrim.balanceOf(trader1Addr)).sub(beforeTraderReserve)).to.equal(userReward);
  }

  it('DIST_0501', async function (): Promise<void> {
    const nftId = await mintNft(erc721, lister);
    await erc721.connect(lister).approve(listingFacet.address, nftId);
    await DIST05(erc721.address, nftId);
  });

  // UniV3Pos PIL-ETH
  it('DIST_0502', async function (): Promise<void> {
    await pilgrim.transfer(listerAddr, hundredPercent);
    await pilgrim.connect(lister).approve(nfPositionManager.address, hundredPercent);
    await weth.transfer(listerAddr, hundredPercent);
    await weth.connect(lister).approve(nfPositionManager.address, hundredPercent);

    const [token0, token1] = sortTokenAddrs(pilgrim.address, weth.address);
    const mintReceipt = await (await nfPositionManager.connect(lister).mint({
      token0,
      token1,
      fee: FeeAmount.LOW,
      tickLower: getMinTick(TICK_SPACINGS[FeeAmount.LOW]),
      tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.LOW]),
      amount0Desired: oneEther,
      amount1Desired: oneEther,
      amount0Min: oneEther,
      amount1Min: oneEther,
      recipient: listerAddr,
      deadline,
    })).wait();

    const { tokenId } = getEventArgs(mintReceipt, 'IncreaseLiquidity');

    await nfPositionManager.connect(lister).approve(core.address, tokenId);

    const extraRewardParam = 5;
    await managingFacet.setUniV3ExtraRewardParam(pilgrim.address, weth.address, extraRewardParam);
    await DIST05(nfPositionManager.address, tokenId, extraRewardParam);
  });
});
