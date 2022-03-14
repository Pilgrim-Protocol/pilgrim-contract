import { ethers } from 'hardhat';
import hre from 'hardhat';

const networkName = hre.network.name;
const { chainId } = hre.network.config;

import { getBigNumber } from '../../../test/uniswap/testUtils';
import type { PilgrimMetaNFT } from '../../../typechain';
import { uniswapV3FactoryAddress, uniswapV3SwapRouterAddress } from '../uniswapV3';

import { deployDiamondAll, deployFacets } from './index';

export * from './deploy';
