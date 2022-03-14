import { BigNumber, constants } from 'ethers';
import { ethers } from 'hardhat';

import {
  encodePriceSqrt,
  FeeAmount,
  getBigNumber,
  getMaxTick,
  getMinTick,
  TICK_SPACINGS,
} from '../../test/uniswap/testUtils';
import { ERC20Mock } from '../../typechain';

export const deployUniV3 = async () => {
  const signers = await ethers.getSigners();
  const alice = signers[0];

  const ERC20MockFactory = await ethers.getContractFactory('ERC20Mock');
  const pilgrim = await ERC20MockFactory.deploy('Pilgrim', 'PIL', getBigNumber('10000000'));
  const weth = await ERC20MockFactory.deploy('WETH', 'WETH', getBigNumber('10000000'));

  const factory = await (await ethers.getContractFactory('UniswapV3Factory')).deploy();
  const UniswapV3PoolFactory = await ethers.getContractFactory('UniswapV3Pool');
  const router = await (await ethers.getContractFactory('SwapRouter')).deploy(factory.address, weth.address);
  const swapTargetCallee = await (await ethers.getContractFactory('TestUniswapV3Callee')).deploy();

  // TODO: _nativeCurrencyLabelBytes?
  const tokenDescriptor = await (await ethers.getContractFactory('NonfungibleTokenPositionDescriptor')).deploy(weth.address, []);
  const nfPositionManager = await (await ethers.getContractFactory('NonfungiblePositionManager')).deploy(factory.address, weth.address, tokenDescriptor.address);

  const createSLP = async (tokenA: ERC20Mock, tokenB: ERC20Mock, amount: BigNumber) => {
    const createPoolTx = await factory.createPool(tokenA.address, tokenB.address, FeeAmount.MEDIUM);

    // @ts-ignore
    const poolAddress = (await createPoolTx.wait()).events[0].args.pool;
    const pool = await UniswapV3PoolFactory.attach(poolAddress);

    await pool.initialize(encodePriceSqrt(1, 1));
    await tokenA.approve(nfPositionManager.address, constants.MaxUint256);
    await tokenB.approve(nfPositionManager.address, constants.MaxUint256);
    const tickSpacing = TICK_SPACINGS[FeeAmount.MEDIUM];
    const tokenInfo = await nfPositionManager.mint(pool.address, alice.address, getMinTick(tickSpacing), getMaxTick(tickSpacing), amount);
    return { pool, tokenInfo };
  };

  return {
    pilgrim,
    weth,
    factory,
    router,
    tokenDescriptor,
    nfPositionManager,
    createSLP,
  };
};
