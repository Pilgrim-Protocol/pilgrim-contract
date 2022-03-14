import { ethers } from 'hardhat';

import type { PilgrimToken } from '../../../typechain';
import { logDone, logStart, writeDeployResult } from '../../libraries/utils';

export type Deploy004PeripheryOptions = {
};

export const defaultDeploy004PeripheryOptions: Deploy004PeripheryOptions = {
};

export const deploy004Periphery = async (
  pil: PilgrimToken,
  whiteList: Array<string>,
  override: Deploy004PeripheryOptions = defaultDeploy004PeripheryOptions,
) => {
  const options = { ...defaultDeploy004PeripheryOptions, ...override };
  logStart('PilgrimTreasury');
  const treasury = await (await ethers.getContractFactory('PilgrimTreasury')).deploy(
    pil.address,
    whiteList,
  );
  await treasury.deployed();
  logDone('PilgrimTreasury', treasury.address);
  writeDeployResult('PilgrimTreasury', treasury.address);
  return { treasury };
};
