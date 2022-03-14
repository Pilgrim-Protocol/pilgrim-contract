import { Contract, ContractReceipt, Signer } from 'ethers';
import { ethers } from 'hardhat';

import { getEventArgs } from '../../../test/testUtils';
import {
  Diamond,
  DiamondCutFacet,
  DiamondLoupeFacet,
  IDiamondCut,
  OwnershipFacet,
} from '../../../typechain';
import { logStart, logDone, log } from '../utils';

import { FacetCutAction, getSelectors } from './utils';

export type FacetConstructInfo = {
  path: string;
  args?: any[];
};
export type DiamondCut = {
  facetAddress: string;
  action: number;
  functionSelectors: string[];
};

export const deployDiamondFacets = async () => {
  // Deploy DiamondCutFacet
  logStart('DiamondCutFacet');
  const diamondCutFacet: DiamondCutFacet = await (
    await ethers.getContractFactory('DiamondCutFacet')
  ).deploy();
  await diamondCutFacet.deployed();
  logDone('DiamondCutFacet', diamondCutFacet.address);

  // Deploy DiamondLoupeFacet
  logStart('DiamondLoupeFacet');
  const diamondLoupeFacet: DiamondLoupeFacet = await (
    await ethers.getContractFactory('DiamondLoupeFacet')
  ).deploy();
  await diamondLoupeFacet.deployed();
  logDone('DiamondLoupeFacet', diamondLoupeFacet.address);

  // Deploy OwnershipFacet
  logStart('OwnershipFacet');
  const ownershipFacet: OwnershipFacet = await (
    await ethers.getContractFactory('OwnershipFacet')
  ).deploy();
  await ownershipFacet.deployed();
  logDone('OwnershipFacet', ownershipFacet.address);

  return {
    diamondCutFacet,
    diamondLoupeFacet,
    ownershipFacet,
  };
};

async function deployDiamond(
  initDiamondPath: string,
  diamondCutFacet: DiamondCutFacet,
  diamondLoupeFacet: DiamondLoupeFacet,
  ownershipFacet: OwnershipFacet,
  args: any[],
): Promise<Diamond> {
  const [owner]: Signer[] = await ethers.getSigners();

  // Deploy Diamond
  logStart('Diamond');
  const diamond: Diamond = await (
    await ethers.getContractFactory('Diamond')
  ).deploy(await owner.getAddress(), diamondCutFacet.address);
  await diamond.deployed();
  logDone('Diamond', diamond.address);

  // Deploy InitDiamond
  logStart('InitDiamond');
  const initDiamond: Contract = await (
    await ethers.getContractFactory(initDiamondPath)
  ).deploy();
  await initDiamond.deployed();
  logDone('InitDiamond', initDiamond.address);

  // Deploy diamond facets
  const cuts: DiamondCut[] = [];
  cuts.push({
    facetAddress: diamondLoupeFacet.address,
    action: FacetCutAction.Add,
    functionSelectors: getSelectors(diamondLoupeFacet),
  });
  cuts.push({
    facetAddress: ownershipFacet.address,
    action: FacetCutAction.Add,
    functionSelectors: getSelectors(ownershipFacet),
  });

  const initFunctionCall: string = initDiamond.interface.encodeFunctionData(
    'init',
    args,
  );
  const diamondCut: IDiamondCut = await ethers.getContractAt(
    'IDiamondCut',
    diamond.address,
  );
  log('[DiamondCut]: Start Tx...');
  const cutReceipt: ContractReceipt = await (
    await diamondCut.diamondCut(cuts, initDiamond.address, initFunctionCall)
  ).wait();
  getEventArgs(cutReceipt, 'DiamondCut');
  log('[DiamondCut]: Done');

  return diamond;
}

export async function deployDiamondAll(
  initDiamondPath: string,
  args: any[],
): Promise<Diamond> {
  const {
    diamondCutFacet,
    diamondLoupeFacet,
    ownershipFacet,
  } = await deployDiamondFacets();

  // Deploy Diamond
  const diamond: Diamond = await deployDiamond(
    initDiamondPath,
    diamondCutFacet,
    diamondLoupeFacet,
    ownershipFacet,
    args,
  );
  return diamond;
}

// Deploy other facets
export const addFacets = async (
  diamond: Diamond,
  facets: Contract[],
) => {
  const cuts: DiamondCut[] = facets.map(facet => {
    return {
      facetAddress: facet.address,
      action: FacetCutAction.Add,
      functionSelectors: getSelectors(facet),
    };
  });
  const diamondCut: IDiamondCut = await ethers.getContractAt(
    'IDiamondCut',
    diamond.address,
  );
  log('[DiamondCut]: Start Tx...');
  const cutReceipt: ContractReceipt = await (
    await diamondCut.diamondCut(cuts, '0x0000000000000000000000000000000000000000', [])
  ).wait();
  log('[DiamondCut]: Done');
  return getEventArgs(cutReceipt, 'DiamondCut');
};

export const deployFacets = async (
  diamond: Diamond,
  infoArray: FacetConstructInfo[],
) => {
  const facets: Contract[] = [];
  for (const info of infoArray) {
    logStart(info.path);
    const facet = await (
      await ethers.getContractFactory(info.path)).deploy(...(info.args ?? []),
    );
    await facet.deployed();
    facets.push(facet);
    logDone(info.path, facet.address);
  }
  // eslint-disable-next-line
  return await addFacets(diamond, facets);
};

if (require.main === module) {

}
