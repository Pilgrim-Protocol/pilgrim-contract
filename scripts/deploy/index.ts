import { BigNumber, constants } from 'ethers';
import hre, { ethers } from 'hardhat';

import { encodePriceSqrt, FeeAmount, getMaxTick, getMinTick, TICK_SPACINGS } from '../../test/uniswap/testUtils';
import { ERC20Mock, IWETH9 } from '../../typechain';
import { log } from '../libraries/utils';

import { defaultDeploy001TokensOptions, deploy001Tokens, Deploy001TokensOptions } from './001_Tokens';
import { defaultDeploy001UniswapV3Options, deploy001UniswapV3, Deploy001UniswapV3Options } from './001_UniswapV3';
import { defaultDeploy002StakingOptions, deploy002Staking, Deploy002StakingOptions } from './002_Staking';
import { defaultDeploy003CoreOptions, deploy003Core, Deploy003CoreOptions } from './003_Core';
import { defaultDeploy004PeripheryOptions, deploy004Periphery, Deploy004PeripheryOptions } from './004_Periphery';

export type DeployStakingOptions =
    Deploy001TokensOptions
    & Deploy001UniswapV3Options
    & Deploy002StakingOptions
    & Deploy004PeripheryOptions;
export const defaultDeployStakingOptions: DeployStakingOptions = {
  ...defaultDeploy001TokensOptions,
  ...defaultDeploy001UniswapV3Options,
  ...defaultDeploy002StakingOptions,
  ...defaultDeploy004PeripheryOptions,
};
export const deployStaking = async (
  override: DeployStakingOptions = defaultDeployStakingOptions,
) => {
  const options = { ...defaultDeployStakingOptions, ...override };
  const tokens = await deploy001Tokens(options);
  const univ3 = await deploy001UniswapV3(options);
  const staking = await deploy002Staking(
    tokens.pilgrim,
    tokens.xPilgrim,
    univ3.factory,
    univ3.router,
    options,
  );
  const periphery = await deploy004Periphery(
    tokens.pilgrim,
    [staking.staking.address],
  );

  await (await ethers.getContractAt('PilgrimMakerFacet', staking.staking.address)).setTreasury(periphery.treasury.address);

  await tokens.pilgrim.mint(BigNumber.from(10).pow(27));
  await tokens.pilgrim.transfer(periphery.treasury.address, BigNumber.from(10).pow(27));
  return {
    ...tokens,
    ...univ3,
    ...staking,
  };
};

export type DeployAllOptions =
    Deploy001TokensOptions
    & Deploy001UniswapV3Options
    & Deploy002StakingOptions
    & Deploy003CoreOptions
    & Deploy004PeripheryOptions;
export const defaultDeployAllOptions: DeployAllOptions = {
  ...defaultDeploy001TokensOptions,
  ...defaultDeploy001UniswapV3Options,
  ...defaultDeploy002StakingOptions,
  ...defaultDeploy003CoreOptions,
  ...defaultDeploy004PeripheryOptions,
};
export const deployAll = async (
  override: DeployAllOptions = defaultDeployAllOptions,
) => {
  const options = { ...defaultDeployAllOptions, ...override };
  log('============= 1. Tokens =============');
  const tokens = await deploy001Tokens(options);
  log('============= 2. UniV3 =============');
  const univ3 = await deploy001UniswapV3(options);
  log('============= 3. Staking =============');
  const staking = await deploy002Staking(
    tokens.pilgrim,
    tokens.xPilgrim,
    univ3.factory,
    univ3.router,
    options,
  );
  log('============= 4. Core =============');
  const core = await deploy003Core(
    tokens.pilgrimMetaNFT,
    staking.staking,
    univ3.nfPositionManager,
    univ3.factory,
    univ3.weth,
    tokens.pilgrim,
    options,
  );
  log('============= 5. Periphery =============');
  const periphery = await deploy004Periphery(
    tokens.pilgrim,
    [core.core.address, staking.staking.address],
  );

  log('============= 6. Set Initial Parameters =============');
  await (await (await ethers.getContractAt('PilgrimMakerFacet', staking.staking.address)).setTreasury(periphery.treasury.address)).wait();

  await (await tokens.xPilgrim.transferOwnership(staking.staking.address)).wait();

  const managingFacet = await ethers.getContractAt('ManagingFacet', core.core.address);
  await (await managingFacet.setTreasury(periphery.treasury.address)).wait();
  await (await managingFacet.setBaseFee(1)).wait();
  await (await managingFacet.setRoundFee(4)).wait();
  await (await managingFacet.setNftFee(25)).wait();

  if (hre.network.name === 'hardhat' || hre.network.name === 'localhost') {
    const treasuryReserve = BigNumber.from(10).pow(26); // 100M
    await (await tokens.pilgrim.mint(BigNumber.from(10).pow(28))).wait();
    await (await tokens.pilgrim.transfer(periphery.treasury.address, BigNumber.from(10).pow(27))).wait();
  }

  let testERC20;
  if (hre.network.name === 'hardhat') {
    const createSLP = async (tokenA: ERC20Mock | IWETH9, tokenB: ERC20Mock, amount: BigNumber) => {
      const createPoolTx = await univ3.factory.createPool(tokenA.address, tokenB.address, FeeAmount.LOW);
      const swapTargetCallee = await (await ethers.getContractFactory('TestUniswapV3Callee')).deploy();

      // @ts-ignore
      const poolAddress = (await createPoolTx.wait()).events[0].args.pool;
      const pool = await (await ethers.getContractFactory('UniswapV3Pool')).attach(poolAddress);

      await pool.initialize(encodePriceSqrt(1, 1));
      await tokenA.approve(swapTargetCallee.address, constants.MaxUint256);
      await tokenB.approve(swapTargetCallee.address, constants.MaxUint256);
      const tickSpacing = TICK_SPACINGS[FeeAmount.LOW];
      const [deployer] = await ethers.getSigners();
      await swapTargetCallee.mint(pool.address, await deployer.getAddress(), getMinTick(tickSpacing), getMaxTick(tickSpacing), amount);
      return pool;
    };

    testERC20 = await (await ethers.getContractFactory('ERC20Mock')).deploy('TestERC20', 'TERC20', BigNumber.from(10).pow(28));
    await testERC20.deployed();

    createSLP(univ3.weth, tokens.pilgrim, BigNumber.from(10).pow(18));
    createSLP(univ3.weth, testERC20, BigNumber.from(10).pow(18));
  }

  log('============= Success =============');

  return {
    ...tokens,
    ...univ3,
    ...staking,
    ...core,
    ...periphery,
    testERC20,
  };
};

if (require.main === module) {
  deployAll()
    .then(() => process.exit(0))
    .catch(error => {
      console.error(error);
      process.exit(1);
    });
}
