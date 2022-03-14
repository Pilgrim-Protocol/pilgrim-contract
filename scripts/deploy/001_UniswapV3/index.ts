import { formatBytes32String } from 'ethers/lib/utils';
import hre, { ethers } from 'hardhat';

import { getBigNumber } from '../../../test/uniswap/testUtils';
import {
  uniswapV3FactoryAddress,
  uniswapV3NonfungiblePositionManager,
  uniswapV3NonfungibleTokenPositionDescriptor,
  uniswapV3SwapRouterAddress,
  wethAddress,
} from '../../libraries/uniswapV3';
import { log, writeDeployResult } from '../../libraries/utils';

export const deployUniswapV3Mock = async () => {
  const weth = await (await ethers.getContractFactory('ERC20Mock')).deploy('WETH', 'WETH', getBigNumber('10000000')); // TODO: Use WETH9?
  writeDeployResult('WETH', weth.address);
  const factory = await (await ethers.getContractFactory('UniswapV3Factory')).deploy();
  writeDeployResult('UniswapV3Factory', factory.address);
  const router = await (await ethers.getContractFactory('SwapRouter')).deploy(factory.address, weth.address);
  writeDeployResult('SwapRouter', router.address);
  const nftDescriptor = await (await ethers.getContractFactory('NFTDescriptor')).deploy();
  writeDeployResult('NFTDescriptor', nftDescriptor.address);
  const tokenDescriptor = await (await ethers.getContractFactory('NonfungibleTokenPositionDescriptor', {
    libraries: {
      NFTDescriptor: nftDescriptor.address,
    },
  })).deploy(weth.address, formatBytes32String('ETH'));
  writeDeployResult('NonfungibleTokenPositionDescriptor', tokenDescriptor.address);
  const nfPositionManager = await (await ethers.getContractFactory('NonfungiblePositionManager')).deploy(factory.address, weth.address, tokenDescriptor.address);
  writeDeployResult('NonfungiblePositionManager', nfPositionManager.address);

  return {
    weth,
    factory,
    router,
    tokenDescriptor,
    nfPositionManager,
  };
};

export const getDeployedUniswapV3 = async () => {
  log('[UniV3] Skip deploying UniV3');
  const weth = await ethers.getContractAt('IWETH9', wethAddress);
  const factory = await ethers.getContractAt('UniswapV3Factory', uniswapV3FactoryAddress);
  const router = await ethers.getContractAt('SwapRouter', uniswapV3SwapRouterAddress);
  const tokenDescriptor = await ethers.getContractAt('NonfungibleTokenPositionDescriptor', uniswapV3NonfungibleTokenPositionDescriptor);
  const nfPositionManager = await ethers.getContractAt('NonfungiblePositionManager', uniswapV3NonfungiblePositionManager);

  return {
    weth,
    factory,
    router,
    tokenDescriptor,
    nfPositionManager,
  };
};


export type Deploy001UniswapV3Options = {
};
export const defaultDeploy001UniswapV3Options: Deploy001UniswapV3Options = {
};
export const deploy001UniswapV3 = async (
  options: Deploy001UniswapV3Options = defaultDeploy001UniswapV3Options,
) => {
  const networkName = hre.network.name;
  const { chainId } = hre.network.config;

  if (networkName === 'hardhat' || networkName === 'localhost') {
    return deployUniswapV3Mock();
  }
  return getDeployedUniswapV3();
};
