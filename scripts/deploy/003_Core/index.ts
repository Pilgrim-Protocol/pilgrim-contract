import type { Diamond, PilgrimMetaNFT, NonfungiblePositionManager } from '../../../typechain';
import { ERC20Mock, IWETH9, PilgrimToken, UniswapV3Factory } from '../../../typechain';
import { deployDiamondAll, deployFacets } from '../../libraries/diamond/deploy';
import { logDone, logStart, writeDeployResult } from '../../libraries/utils';

export type Deploy003CoreOptions = {
  rewardEpoch: number;
};
export const defaultDeploy003CoreOptions: Deploy003CoreOptions = {
  rewardEpoch: 100,
};
export const deploy003Core = async (
  metaNFT: PilgrimMetaNFT,
  staking: Diamond,
  uniV3Pos: NonfungiblePositionManager,
  uniV3Factory: UniswapV3Factory,
  weth: ERC20Mock | IWETH9,
  pil: PilgrimToken,
  override: Deploy003CoreOptions = defaultDeploy003CoreOptions,
) => {
  const options = { ...defaultDeploy003CoreOptions, ...override };
  logStart('Core Diamond');
  const core = await deployDiamondAll(
    'contracts/core/InitDiamond.sol:InitDiamond',
    [[metaNFT.address, staking.address, uniV3Pos.address, uniV3Factory.address, weth.address, pil.address, options.rewardEpoch]],
  );
  logDone('Core Diamond', core.address);

  logStart('Core Facets');
  const coreCuts = await deployFacets(core, [
    { path: 'AMMFacet' },
    { path: 'ERC721ReceiverFacet' },
    { path: 'ListingFacet' },
    { path: 'ViewFacet' },
    { path: 'DistributionFacet' },
    { path: 'ManagingFacet' },
  ]);
  await (await metaNFT.setCore(core.address)).wait();
  logDone('Core Facets');
  writeDeployResult('Core', core.address);
  return { core, coreCuts };
};
