import fs from 'fs';

import hre from 'hardhat';

const isProd = hre.network.name !== 'hardhat';

export const writeDeployResult = (name: string, addr: string) => {
  const path = './deployment';
  if (!fs.existsSync(path)) {
    fs.mkdirSync(path);
  }
  fs.writeFileSync(`${path}/${name}.json`, JSON.stringify({ address: addr }, null, 2));
};

export const log = (msg: string): void => {
  if (isProd) console.log(msg);
};

export const logStart = (name: string): void => {
  log(`[${name}] Start deploying...`);
};

export const logDone = (name: string, address: string = ''): void => {
  log(`[${name}] Done${address === '' ? '' : `: ${address}`}`);
};
