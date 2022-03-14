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
import {
  bigNumber1,
  encodePriceSqrt,
  FeeAmount,
  getBigNumber,
  getMaxTick,
  getMinTick,
  TICK_SPACINGS,
} from '../../uniswap/testUtils';

describe('00_StakingDiamond', function () {
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

  const deployAll = async function (lockupPeriod: number) {
    // @ts-ignore
    ({ pilgrim, xPilgrim, factory, staking, weth } = await deployStaking({ lockupPeriod }));

    const mint = async (to: string, amount: string) => {
      await pilgrim.mint(amount);
      await pilgrim.transfer(to, amount);
    };
    await Promise.all([
      mint(alice.address, bigNumber1.mul(100).toString()),
      mint(bob.address, bigNumber1.toString()),
      mint(carol.address, bigNumber1.toString()),
    ]);

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
  };

  describe('compound case', function () {
    it('Stake, Convert ETH - PIL, Unstake', async function () {
      await deployAll(0);

      await pilgrim.connect(bob).approve(pilgrimTemple.address, bigNumber1);
      await pilgrimTemple.connect(bob).enter(bigNumber1);
      expect(await pilgrim.balanceOf(pilgrimTemple.address)).to.equal(bigNumber1);

      await pilgrimMaker.setBridge(weth.address, pilgrim.address, FeeAmount.MEDIUM);
      await weth.transfer(pilgrimMaker.address, bigNumber1);
      await pilgrimMaker.convertToPIL(weth.address);
      expect(await weth.balanceOf(pilgrimMaker.address)).to.equal(0);
      expect(await pilgrim.balanceOf(pilgrimTemple.address)).to.equal(bigNumber1.add(BigNumber.from('499248873309964947')));

      await pilgrimTemple.connect(bob).leave(bigNumber1);
      expect(await pilgrim.balanceOf(pilgrimTemple.address)).to.equal(0);
      expect(await pilgrim.balanceOf(bob.address)).to.equal(bigNumber1.add(BigNumber.from('499248873309964947')));
    });
  });
});
