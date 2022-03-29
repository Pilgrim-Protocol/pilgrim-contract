import type { PilgrimToken, SwapRouter, UniswapV3Factory, XPilgrim } from '../../../typechain';
import { deployDiamondAll, deployFacets } from '../../libraries/diamond/deploy';
import { logDone, logStart, writeDeployResult } from '../../libraries/utils';

export type Deploy002StakingOptions = {
  lockupPeriod: number;
};
export const defaultDeploy002StakingOptions: Deploy002StakingOptions = {
  lockupPeriod: 365 * 86500,
};
export const deploy002Staking = async (
  pilgrim: PilgrimToken,
  xPilgrim: XPilgrim,
  factory: UniswapV3Factory,
  router: SwapRouter,
  override: Deploy002StakingOptions = defaultDeploy002StakingOptions,
) => {
  const options = { ...defaultDeploy002StakingOptions, ...override };
  logStart('Staking Diamond');
  const diamond = await deployDiamondAll(
    'contracts/staking/InitDiamond.sol:InitDiamond',
    [{
      pilgrim: pilgrim.address,
      xPilgrim: xPilgrim.address,
      lockupPeriod: options.lockupPeriod,
      subsidizationNumerator: 0,
      subsidizationDenominator: 1,
    }],
  );
  logDone('Staking Diamond', diamond.address);

  logStart('Staking Facets');
  await deployFacets(diamond, [
    { path: 'PilgrimMakerFacet', args: [factory.address, router.address] },
    { path: 'PilgrimTempleFacet' },
  ]);
  logDone('Staking Facets');
  writeDeployResult('Staking', diamond.address);
  return { staking: diamond };
};
