import hre from 'hardhat';

const networkName = hre.network.name;
const { chainId } = hre.network.config;

// https://github.com/Uniswap/v3-periphery/blob/main/deploys.md
// The latest version of @uniswap/v3-core, @uniswap/v3-periphery are deployed to Ethereum mainnet and all testnets at the same addresses.

// Both mainnet and all other testnets
export const uniswapV3FactoryAddress = '0x1F98431c8aD98523631AE4a59f267346ea31F984';
export const uniswapV3SwapRouterAddress = '0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45'; // 1.1.0

export const uniswapV3NFTDescriptor = '0x42B24A95702b9986e82d421cC3568932790A48Ec';
export const uniswapV3NonfungibleTokenPositionDescriptor = '0x91ae842A5Ffd8d12023116943e72A606179294f3';
export const uniswapV3NonfungiblePositionManager = '0xC36442b4a4522E871399CD717aBDD847Ab11FE88';

export let wethAddress = '';

switch (chainId) {
  case 1: // Mainnet
    wethAddress = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';
    break;
  case 3: // Ropsten
    wethAddress = '0xc778417E063141139Fce010982780140Aa0cD5Ab';
    break;
  case 4: // Rinkeby
    wethAddress = '0xc778417E063141139Fce010982780140Aa0cD5Ab';
    break;
  case 31337: // Hardhat
    break;
  case undefined:
    if (networkName === 'localhost') break;
  default:
    throw new Error('Unknown chain id');
}
