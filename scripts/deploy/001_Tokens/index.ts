import { ethers } from 'hardhat';

import { PilgrimMetaNFT, PilgrimToken, XPilgrim } from '../../../typechain';
import { logDone, logStart, writeDeployResult } from '../../libraries/utils';

export const deployToken = async (name: string) => {
  logStart(name);
  const contract = await (await ethers.getContractFactory(name)).deploy();
  await contract.deployed();
  writeDeployResult(name, contract.address);
  logDone(name, contract.address);
  return contract;
};

export type Deploy001TokensOptions = {
};
export const defaultDeploy001TokensOptions: Deploy001TokensOptions = {
};
export const deploy001Tokens = async (
  options: Deploy001TokensOptions = defaultDeploy001TokensOptions,
) => {
  const pilgrimMetaNFT = (await deployToken('PilgrimMetaNFT')) as PilgrimMetaNFT;
  const pilgrim = (await deployToken('PilgrimToken')) as PilgrimToken;
  const xPilgrim = (await deployToken('XPilgrim')) as XPilgrim;
  return { pilgrimMetaNFT, pilgrim, xPilgrim };
};
