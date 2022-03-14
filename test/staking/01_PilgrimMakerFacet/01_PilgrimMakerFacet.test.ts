import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { expect } from 'chai';
import { BigNumber, constants } from 'ethers';
import { ethers } from 'hardhat';

import { deployStaking } from '../../../scripts/deploy';
import {
  Diamond,
  ERC20Mock, PilgrimMakerFacet, PilgrimMakerFacetExploitMock, PilgrimTempleFacet,
  TestUniswapV3Callee,
  UniswapV3Factory,
  UniswapV3Pool,
  UniswapV3Pool__factory,
  PilgrimToken,
  XPilgrim,
} from '../../../typechain';
import { runROMethod } from '../../testUtils';
import { encodePriceSqrt, FeeAmount, getBigNumber, getMaxTick, getMinTick, TICK_SPACINGS } from '../../uniswap/testUtils';

describe('PilgrimMaker', function () {
  let signers: SignerWithAddress[];
  let alice: SignerWithAddress;
  let bob: SignerWithAddress;
  let carol: SignerWithAddress;

  let staking: Diamond;

  let pilgrim: PilgrimToken;
  let xPilgrim: XPilgrim;

  let weth: ERC20Mock;
  let wbtc: ERC20Mock;
  let dai: ERC20Mock;
  let usdc: ERC20Mock;
  let samo: ERC20Mock;

  let factory: UniswapV3Factory;
  let UniswapV3PoolFactory: UniswapV3Pool__factory;
  let swapTargetCallee: TestUniswapV3Callee;

  let pilgrimMaker: PilgrimMakerFacet;
  let pilgrimMakerExploiter: PilgrimMakerFacetExploitMock;
  let pilgrimTemple: PilgrimTempleFacet;

  let pilWeth: UniswapV3Pool;
  let pilUsdc: UniswapV3Pool;
  let wethUsdc: UniswapV3Pool;
  let wethDai: UniswapV3Pool;
  let daiWbtc: UniswapV3Pool;
  let samoDai: UniswapV3Pool;
  let samoWbtc: UniswapV3Pool;

  before(async function () {
    signers = await ethers.getSigners();
    alice = signers[0];
    bob = signers[1];
    carol = signers[2];
  });

  beforeEach(async function () {
    // @ts-ignore
    ({ pilgrim, xPilgrim, factory, staking, weth } = await deployStaking());
    await pilgrim.mint(getBigNumber('10000000'));

    const ERC20MockFactory = await ethers.getContractFactory('ERC20Mock');
    wbtc = await ERC20MockFactory.deploy('WBTC', 'WBTC', getBigNumber('10000000'));
    dai = await ERC20MockFactory.deploy('DAI', 'DAI', getBigNumber('10000000'));
    usdc = await ERC20MockFactory.deploy('USDC', 'USDC', getBigNumber('10000000'));
    samo = await ERC20MockFactory.deploy('Samoyedcoin', 'SAMO', getBigNumber('10000000'));

    UniswapV3PoolFactory = await ethers.getContractFactory('UniswapV3Pool');
    swapTargetCallee = await (await ethers.getContractFactory('TestUniswapV3Callee')).deploy();

    pilgrimMaker = await ethers.getContractAt('PilgrimMakerFacet', staking.address);
    pilgrimTemple = await ethers.getContractAt('PilgrimTempleFacet', staking.address);
    await xPilgrim.transferOwnership(pilgrimTemple.address);

    pilgrimMakerExploiter = await (await ethers.getContractFactory('PilgrimMakerFacetExploitMock')).deploy(staking.address);

    const createSLP = async (tokenA: ERC20Mock, tokenB: ERC20Mock, amount: BigNumber) => {
      const createPoolTx = await factory.createPool(tokenA.address, tokenB.address, FeeAmount.MEDIUM);

      // @ts-ignore
      const poolAddress = (await createPoolTx.wait()).events[0].args.pool;
      const pool = await UniswapV3PoolFactory.attach(poolAddress);

      await pool.initialize(encodePriceSqrt(1, 1));
      await tokenA.approve(swapTargetCallee.address, constants.MaxUint256);
      await tokenB.approve(swapTargetCallee.address, constants.MaxUint256);
      const tickSpacing = TICK_SPACINGS[FeeAmount.MEDIUM];
      await swapTargetCallee.mint(pool.address, alice.address, getMinTick(tickSpacing), getMaxTick(tickSpacing), amount);
      return pool;
    };

    /*
    Mock Uniswap V3 Pools
    pil -- weth -- dai -- wbtc
       \   /         \    /
       usdc           samo
     */
    // deploy pools
    pilWeth = await createSLP(pilgrim, weth, getBigNumber('1'));
    pilUsdc = await createSLP(pilgrim, usdc, getBigNumber('1'));
    wethUsdc = await createSLP(weth, usdc, getBigNumber('1'));
    wethDai = await createSLP(weth, dai, getBigNumber('1'));
    daiWbtc = await createSLP(dai, wbtc, getBigNumber('1'));
    samoDai = await createSLP(samo, dai, getBigNumber('1'));
    samoWbtc = await createSLP(samo, wbtc, getBigNumber('1'));
  });

  describe('bridgeFor()', function () {
    // STAKING_010101
    it('Get bridge when exist', async function () {
      await pilgrimMaker.setBridge(weth.address, pilgrim.address, FeeAmount.MEDIUM);
      await runROMethod({
        method: pilgrimMaker.bridgeFor(weth.address),
        expectedArgs: {
          from: weth.address,
          to: pilgrim.address,
          fee: FeeAmount.MEDIUM,
        },
      });
    });

    // STAKING_010102
    it('Get empty bridge when not exist', async function () {
      await runROMethod({
        method: pilgrimMaker.bridgeFor(weth.address),
        expectedArgs: {},
      });
    });
  });

  describe('setBridge()', function () {
    // STAKING_010201
    it('Set bridge to PIL with eligible UniswapV3 pool (WETH-PIL)', async function () {
      await pilgrimMaker.setBridge(weth.address, pilgrim.address, FeeAmount.MEDIUM);
    });

    // STAKING_010202
    it('Set bridge for PIL (PIL-WETH)', async function () {
      // does not allow to set bridge for Pilgrim
      await expect(pilgrimMaker.setBridge(pilgrim.address, weth.address, FeeAmount.MEDIUM)).to.be.revertedWith('PilgrimMaker: Invalid bridge');
    });

    // STAKING_010203
    it('Set bridge for itself (WETH-WETH)', async function () {
      // does not allow to set bridge to itself
      await expect(pilgrimMaker.setBridge(dai.address, dai.address, FeeAmount.MEDIUM)).to.be.revertedWith('PilgrimMaker: Invalid bridge');
    });

    // STAKING_010204
    it('Set bridge having no route to PIL (DAI-WETH)', async function () {
      // does not allow to set bridge with no route to PIL
      await expect(pilgrimMaker.setBridge(dai.address, weth.address, FeeAmount.MEDIUM)).to.be.revertedWith('PilgrimMaker: Invalid bridge, no route to PIL found');
    });

    // STAKING_010205
    it('Set bridge with route to PIL (WETH-PIL & DAI-WETH)', async function () {
      await pilgrimMaker.setBridge(weth.address, pilgrim.address, FeeAmount.MEDIUM);
      await pilgrimMaker.setBridge(dai.address, weth.address, FeeAmount.MEDIUM);
    });

    // STAKING_010206
    it('Set bridge without Uniswap V3 Pool (DAI-PIL)', async function () {
      // does not allow to set bridge with no Uniswap pool
      await expect(pilgrimMaker.setBridge(weth.address, pilgrim.address, FeeAmount.HIGH)).to.be.revertedWith('PilgrimMaker: Invalid bridge, no Uniswap pool found');
      await expect(pilgrimMaker.setBridge(dai.address, pilgrim.address, FeeAmount.MEDIUM)).to.be.revertedWith('PilgrimMaker: Invalid bridge, no Uniswap pool found');
    });

    // STAKING_010207
    it('Set bridge with cycle (WETH-PIL & DAI-WETH & WETH-DAI)', async function () {
      // does not allow to set bridge with cycle
      await pilgrimMaker.setBridge(weth.address, pilgrim.address, FeeAmount.MEDIUM);
      await pilgrimMaker.setBridge(dai.address, weth.address, FeeAmount.MEDIUM);
      await expect(pilgrimMaker.setBridge(weth.address, dai.address, FeeAmount.MEDIUM)).to.be.revertedWith('PilgrimMaker: Invalid bridge, cycle detected');
    });

    // STAKING_010208
    it('Set bridge with cycle 2 (WETH-PIL & DAI-WETH & WBTC-DAI & WETH-WBTC)', async function () {
      await pilgrimMaker.setBridge(weth.address, pilgrim.address, FeeAmount.MEDIUM);
      await pilgrimMaker.setBridge(dai.address, weth.address, FeeAmount.MEDIUM);
      await pilgrimMaker.setBridge(wbtc.address, dai.address, FeeAmount.MEDIUM);
      await pilgrimMaker.setBridge(samo.address, wbtc.address, FeeAmount.MEDIUM);
      await expect(pilgrimMaker.setBridge(dai.address, samo.address, FeeAmount.MEDIUM)).to.be.revertedWith('PilgrimMaker: Invalid bridge, cycle detected');
    });

    // STAKING_010209
    it('Set bridge overrides', async function () {
      await pilgrimMaker.setBridge(weth.address, pilgrim.address, FeeAmount.MEDIUM);
      await pilgrimMaker.setBridge(usdc.address, pilgrim.address, FeeAmount.MEDIUM);
      await pilgrimMaker.setBridge(usdc.address, weth.address, FeeAmount.MEDIUM);
      await runROMethod({
        method: pilgrimMaker.bridgeFor(usdc.address),
        expectedArgs: {
          from: usdc.address,
          to: weth.address,
          fee: FeeAmount.MEDIUM,
        },
      });
    });

    // STAKING_010210
    it('Set bridge emits event', async function () {
      await expect(pilgrimMaker.setBridge(weth.address, pilgrim.address, FeeAmount.MEDIUM))
        .to.emit(pilgrimMaker, 'LogBridgeSet')
        .withArgs(weth.address, pilgrim.address, FeeAmount.MEDIUM);
    });
  });

  describe('convertToPIL()', function () {
    // STAKING_010401
    it('Convert a token with no bridge', async function () {
      await weth.transfer(pilgrimMaker.address, getBigNumber('1'));
      await expect(pilgrimMaker.convertToPIL(weth.address)).to.be.revertedWith('PilgrimMaker: Invalid token, no bridge found');
    });

    // STAKING_010402
    it('Convert ETH - PIL', async function () {
      await pilgrimMaker.setBridge(weth.address, pilgrim.address, FeeAmount.MEDIUM);
      await weth.transfer(pilgrimMaker.address, getBigNumber('1'));
      await pilgrimMaker.convertToPIL(weth.address);
      expect(await weth.balanceOf(pilgrimMaker.address)).to.equal(0);
      expect(await pilgrim.balanceOf(pilgrimTemple.address)).to.equal('499248873309964947');
    });

    // STAKING_010403
    it('Convert emits event correctly', async function () {
      await pilgrimMaker.setBridge(weth.address, pilgrim.address, FeeAmount.MEDIUM);
      await weth.transfer(pilgrimMaker.address, getBigNumber('1'));
      await expect(pilgrimMaker.convertToPIL(weth.address))
        .to.emit(pilgrimMaker, 'LogConvert')
        .withArgs(alice.address, weth.address, getBigNumber('1'), '499248873309964947', 0);
    });

    // STAKING_010404
    it('Convert DAI - ETH - PIL', async function () {
      await pilgrimMaker.setBridge(weth.address, pilgrim.address, FeeAmount.MEDIUM);
      await pilgrimMaker.setBridge(dai.address, weth.address, FeeAmount.MEDIUM);

      await dai.transfer(pilgrimMaker.address, getBigNumber('1'));
      await pilgrimMaker.convertToPIL(dai.address);
      expect(await dai.balanceOf(pilgrimMaker.address)).to.equal(0);
      expect(await weth.balanceOf(pilgrimMaker.address)).to.equal(0);
      expect(await pilgrim.balanceOf(pilgrimTemple.address)).to.equal('332332333336342351');
    });

    // STAKING_010405
    it('Convert WBTC - DAI - ETH - PIL', async function () {
      await pilgrimMaker.setBridge(weth.address, pilgrim.address, FeeAmount.MEDIUM);
      await pilgrimMaker.setBridge(dai.address, weth.address, FeeAmount.MEDIUM);
      await pilgrimMaker.setBridge(wbtc.address, dai.address, FeeAmount.MEDIUM);

      await wbtc.transfer(pilgrimMaker.address, getBigNumber('1'));
      await pilgrimMaker.convertToPIL(wbtc.address);
      expect(await wbtc.balanceOf(pilgrimMaker.address)).to.equal(0);
      expect(await dai.balanceOf(pilgrimMaker.address)).to.equal(0);
      expect(await weth.balanceOf(pilgrimMaker.address)).to.equal(0);
      expect(await pilgrim.balanceOf(pilgrimTemple.address)).to.equal('248874440040122660');
    });
    // STAKING_010406
    it('Convert SAMO - WBTC - DAI - ETH - PIL', async function () {
      await pilgrimMaker.setBridge(weth.address, pilgrim.address, FeeAmount.MEDIUM);
      await pilgrimMaker.setBridge(dai.address, weth.address, FeeAmount.MEDIUM);
      await pilgrimMaker.setBridge(wbtc.address, dai.address, FeeAmount.MEDIUM);
      await pilgrimMaker.setBridge(samo.address, wbtc.address, FeeAmount.MEDIUM);

      await samo.transfer(pilgrimMaker.address, getBigNumber('1'));
      await pilgrimMaker.convertToPIL(samo.address);
      expect(await samo.balanceOf(pilgrimMaker.address)).to.equal(0);
      expect(await wbtc.balanceOf(pilgrimMaker.address)).to.equal(0);
      expect(await dai.balanceOf(pilgrimMaker.address)).to.equal(0);
      expect(await weth.balanceOf(pilgrimMaker.address)).to.equal(0);
      expect(await pilgrim.balanceOf(pilgrimTemple.address)).to.equal('198800005412959911');
    });

    // STAKING_010407
    it('Convert with 0 balance', async function () {
      await pilgrimMaker.setBridge(weth.address, pilgrim.address, FeeAmount.MEDIUM);
      await pilgrimMaker.convertToPIL(weth.address);
      expect(await weth.balanceOf(pilgrimMaker.address)).to.equal(0);
      expect(await pilgrim.balanceOf(pilgrimTemple.address)).to.equal(0);
    });

    // STAKING_010408
    it('Convert with 0 balance does not emit any events', async function () {
      await pilgrimMaker.setBridge(weth.address, pilgrim.address, FeeAmount.MEDIUM);
      await expect(pilgrimMaker.convertToPIL(weth.address))
        .not.to.emit(pilgrimMaker, 'LogConvert');
      expect(await weth.balanceOf(pilgrimMaker.address)).to.equal(0);
      expect(await pilgrim.balanceOf(pilgrimTemple.address)).to.equal(0);
    });

    // STAKING_010409
    it('Convert while Maker has intermediate token balance', async function () {
      await pilgrimMaker.setBridge(weth.address, pilgrim.address, FeeAmount.MEDIUM);
      await pilgrimMaker.setBridge(dai.address, weth.address, FeeAmount.MEDIUM);

      await weth.transfer(pilgrimMaker.address, getBigNumber('1'));
      await dai.transfer(pilgrimMaker.address, getBigNumber('1'));
      await pilgrimMaker.convertToPIL(dai.address);
      expect(await dai.balanceOf(pilgrimMaker.address)).to.equal(0);
      expect(await weth.balanceOf(pilgrimMaker.address)).to.equal('1000000000000000000');
      expect(await pilgrim.balanceOf(pilgrimTemple.address)).to.equal('332332333336342351');
    });
  });

  describe('convertMultiple()', function () {
    // STAKING_010501
    it('Convert multiple called with a token', async function () {
      await pilgrimMaker.setBridge(weth.address, pilgrim.address, FeeAmount.MEDIUM);

      await weth.transfer(pilgrimMaker.address, getBigNumber('1'));
      await pilgrimMaker.convertMultipleTokensToPIL([weth.address]);
      expect(await weth.balanceOf(pilgrimMaker.address)).to.equal(0);
      expect(await pilgrim.balanceOf(pilgrimTemple.address)).to.equal('499248873309964947');
    });

    // STAKING_010502
    it('Convert multiple called with two tokens', async function () {
      await pilgrimMaker.setBridge(weth.address, pilgrim.address, FeeAmount.MEDIUM);
      await pilgrimMaker.setBridge(usdc.address, pilgrim.address, FeeAmount.MEDIUM);

      await weth.transfer(pilgrimMaker.address, getBigNumber('1'));
      await usdc.transfer(pilgrimMaker.address, getBigNumber('1'));
      await pilgrimMaker.convertMultipleTokensToPIL([weth.address, usdc.address]);
      expect(await weth.balanceOf(pilgrimMaker.address)).to.equal(0);
      expect(await usdc.balanceOf(pilgrimMaker.address)).to.equal(0);
      expect(await pilgrim.balanceOf(pilgrimTemple.address)).to.equal('998497746619929894');
    });

    // STAKING_010503
    it('Convert multiple called with three tokens', async function () {
      await pilgrimMaker.setBridge(weth.address, pilgrim.address, FeeAmount.MEDIUM);
      await pilgrimMaker.setBridge(dai.address, weth.address, FeeAmount.MEDIUM);
      await pilgrimMaker.setBridge(usdc.address, pilgrim.address, FeeAmount.MEDIUM);

      await weth.transfer(pilgrimMaker.address, getBigNumber('1'));
      await dai.transfer(pilgrimMaker.address, getBigNumber('1'));
      await usdc.transfer(pilgrimMaker.address, getBigNumber('1'));
      await pilgrimMaker.convertMultipleTokensToPIL([dai.address, usdc.address, weth.address]);
      expect(await dai.balanceOf(pilgrimMaker.address)).to.equal(0);
      expect(await weth.balanceOf(pilgrimMaker.address)).to.equal(0);
      expect(await usdc.balanceOf(pilgrimMaker.address)).to.equal(0);
      expect(await pilgrim.balanceOf(pilgrimTemple.address)).to.equal('1098407286627620562');
    });

    // STAKING_010504
    it('Convert multiple with two or more bridges', async function () {
      await pilgrimMaker.setBridge(weth.address, pilgrim.address, FeeAmount.MEDIUM);
      await pilgrimMaker.setBridge(dai.address, weth.address, FeeAmount.MEDIUM);
      await pilgrimMaker.setBridge(usdc.address, pilgrim.address, FeeAmount.MEDIUM);

      await dai.transfer(pilgrimMaker.address, getBigNumber('1'));
      await usdc.transfer(pilgrimMaker.address, getBigNumber('1'));
      await pilgrimMaker.convertMultipleTokensToPIL([dai.address, usdc.address]);
      expect(await dai.balanceOf(pilgrimMaker.address)).to.equal(0);
      expect(await weth.balanceOf(pilgrimMaker.address)).to.equal(0);
      expect(await usdc.balanceOf(pilgrimMaker.address)).to.equal(0);
      expect(await pilgrim.balanceOf(pilgrimTemple.address)).to.equal('831581206646307298');
    });

    // STAKING_010505
    it('Convert multiple with a token with no bridge reverts with correct message', async function () {
      await pilgrimMaker.setBridge(weth.address, pilgrim.address, FeeAmount.MEDIUM);
      await pilgrimMaker.setBridge(usdc.address, pilgrim.address, FeeAmount.MEDIUM);

      await dai.transfer(pilgrimMaker.address, getBigNumber('1'));
      await usdc.transfer(pilgrimMaker.address, getBigNumber('1'));
      await expect(pilgrimMaker.convertMultipleTokensToPIL([dai.address, usdc.address])).to.be.revertedWith('PilgrimMaker: Invalid token, no bridge found');
    });

    // STAKING_010506
    it('Convert multiple emits LogConvert events', async function () {
      await pilgrimMaker.setBridge(weth.address, pilgrim.address, FeeAmount.MEDIUM);
      await pilgrimMaker.setBridge(dai.address, weth.address, FeeAmount.MEDIUM);
      await pilgrimMaker.setBridge(usdc.address, pilgrim.address, FeeAmount.MEDIUM);

      await dai.transfer(pilgrimMaker.address, getBigNumber('1'));
      await usdc.transfer(pilgrimMaker.address, getBigNumber('1'));
      await expect(pilgrimMaker.convertMultipleTokensToPIL([dai.address, usdc.address]))
        .to.emit(pilgrimMaker, 'LogConvert')
        .withArgs(alice.address, usdc.address, getBigNumber('1'), '499248873309964947', 0)
        .to.emit(pilgrimMaker, 'LogConvert')
        .withArgs(alice.address, dai.address, getBigNumber('1'), '332332333336342351', 0);
    });

    // STAKING_010507
    it('Convert multiple with 0 balances', async function () {
      await pilgrimMaker.setBridge(weth.address, pilgrim.address, FeeAmount.MEDIUM);
      await pilgrimMaker.setBridge(dai.address, weth.address, FeeAmount.MEDIUM);
      await pilgrimMaker.setBridge(usdc.address, pilgrim.address, FeeAmount.MEDIUM);

      await dai.transfer(pilgrimMaker.address, getBigNumber('1'));
      await pilgrimMaker.convertMultipleTokensToPIL([dai.address, usdc.address]);
      expect(await dai.balanceOf(pilgrimMaker.address)).to.equal(0);
      expect(await weth.balanceOf(pilgrimMaker.address)).to.equal(0);
      expect(await usdc.balanceOf(pilgrimMaker.address)).to.equal(0);
      expect(await pilgrim.balanceOf(pilgrimTemple.address)).to.equal('332332333336342351');
    });

    // // STAKING_010508 // TODO: Do we need this test case?
    // it('Convert multiple called with two tokens in different order results in same amount of pilgrim', async function () {
    //   const resultingAmount = new BN('348873537066486224');
    //   await pilgrimMaker.setBridge(weth.address, pilgrim.address, FeeAmount.MEDIUM);
    //   await pilgrimMaker.setBridge(dai.address, weth.address, FeeAmount.MEDIUM);
    //   await pilgrimMaker.setBridge(wbtc.address, dai.address, FeeAmount.MEDIUM);
    //   await pilgrimMaker.setBridge(samo.address, dai.address, FeeAmount.MEDIUM);
    //
    //   await wbtc.transfer(pilgrimMaker.address, getBigNumber('2'));
    //   await samo.transfer(pilgrimMaker.address, getBigNumber('1'));
    //   await pilgrimMaker.convertMultipleTokensToPIL([wbtc.address, samo.address]);
    //   expect(await pilgrim.balanceOf(pilgrimTemple.address)).to.equal(resultingAmount.toFixed());
    // });
  });
});
