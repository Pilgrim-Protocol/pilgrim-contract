import { BigNumberish, ContractReceipt, Signer } from 'ethers';
import { BytesLike, Result } from 'ethers/lib/utils';
import { ethers } from 'hardhat';

import { deployAll } from '../../scripts/deploy';
import { FacetCutAction, getSelector, getSelectors } from '../../scripts/libraries/diamond/utils';
import { Diamond, DiamondCutFacet, DiamondLoupeFacet, ERC20Mock, ERC721Mock, ListingFacet, ManagingFacet, PilgrimMetaNFT } from '../../typechain';
import { NewCoreFacet } from '../../typechain/NewCoreFacet';
import {
  dummyIpfsHash,
  getEventArgs,
  invalidNftAddr,
  listingPrice,
  oneEther,
  runROMethod,
  runRWMethod,
  zeroAddr,
} from '../testUtils';

describe('diamondCut', function () {
  let admin: Signer;
  let user1: Signer;

  let user1Addr: string;

  let core: Diamond;
  let coreCuts: Result;
  let pilgrimMetaNFT: PilgrimMetaNFT;

  let diamondCutFacet: DiamondCutFacet;
  let diamondLoupeFacet: DiamondLoupeFacet;

  let newCoreFacet: NewCoreFacet;
  let newCoreFacetFromCore: NewCoreFacet;

  let listingFacet: ListingFacet;
  let managingFacet: ManagingFacet;

  let testERC20: ERC20Mock;
  let testERC721: ERC721Mock;

  let tokenId: number;

  const test1Selector = getSelector('function test1() external pure returns (uint256 _a)');
  const test2Selector = getSelector('function test2() external view returns (address _a)');
  const test3Selector = getSelector('function test3(address _a) external returns (address _b)');
  const listSelector = getSelector('function list(address _nftAddress, uint256 _tokenId, uint128 _initPrice, address _baseToken, string[] calldata _tags, bytes32 _descriptionHash) external');
  const quoteNftSelector = getSelector('function quoteNft(uint256 _metaNftId) public view returns (uint128 _amountIn, uint128 _amountToMNftHolder, uint128 _amountToRHolderPR)');
  const invalidSelector = '0x00000000';

  this.beforeEach(async function () {
    ({ core, coreCuts, pilgrimMetaNFT } = await deployAll());

    diamondCutFacet = await ethers.getContractAt('DiamondCutFacet', core.address);

    newCoreFacet = await (await ethers.getContractFactory('NewCoreFacet')).deploy();
    newCoreFacetFromCore = await ethers.getContractAt('NewCoreFacet', core.address);

    listingFacet = await ethers.getContractAt('ListingFacet', core.address);
    managingFacet = await ethers.getContractAt('ManagingFacet', core.address);

    [admin, user1] = await ethers.getSigners();

    user1Addr = await user1.getAddress();

    testERC20 = await (
      await ethers.getContractFactory('ERC20Mock')
    ).deploy('TestERC20', 'TERC20', oneEther.mul(1_000_000));
    testERC721 = await (await ethers.getContractFactory('ERC721Mock')).deploy('TestERC721', 'TERC721');

    const mintReceipt: ContractReceipt = await (
      await testERC721.safeMint(user1Addr)
    ).wait();
    tokenId = getEventArgs(mintReceipt, 'Transfer')!.tokenId;
    await testERC721.connect(user1).approve(core.address, tokenId);
    await managingFacet.createPool(testERC20.address, 1, 0);
  });

  /* Add - Positive Cases */
  // Add functions from a new facet
  it('SHARED_010101', async function (): Promise<void> {
    const selectors = [test1Selector, test2Selector];
    const cuts = [
      {
        facetAddress: newCoreFacet.address,
        action: FacetCutAction.Add,
        functionSelectors: selectors,
      },
    ];

    await diamondCutFacet.connect(admin).diamondCut(cuts, zeroAddr, []);

    await runROMethod({
      method: newCoreFacetFromCore.connect(admin).functions.test1(),
      expectedArgs: { _a: 1 },
    });

    await runROMethod({
      method: newCoreFacetFromCore.connect(admin).functions.test2(),
      expectedArgs: { _a: pilgrimMetaNFT.address },
    });
  });

  // Add functions from an existing facet
  it('SHARED_010102', async function (): Promise<void> {
    let cuts = [
      {
        facetAddress: newCoreFacet.address,
        action: FacetCutAction.Add,
        functionSelectors: [test1Selector],
      },
    ];
    await diamondCutFacet.connect(admin).diamondCut(cuts, zeroAddr, []);

    await runROMethod({
      method: newCoreFacetFromCore.connect(admin).functions.test1(),
      expectedArgs: { _a: 1 },
    });

    await runROMethod({
      method: newCoreFacetFromCore.connect(admin).functions.test2(),
      expectRevert: true,
    });

    await runRWMethod({
      method: newCoreFacetFromCore.connect(admin).functions.test3(invalidNftAddr),
      name: 'Test3',
      expectRevert: true,
    });

    cuts = [
      {
        facetAddress: newCoreFacet.address,
        action: FacetCutAction.Add,
        functionSelectors: [test2Selector, test3Selector],
      },
    ];
    await diamondCutFacet.connect(admin).diamondCut(cuts, zeroAddr, []);

    await runROMethod({
      method: newCoreFacetFromCore.connect(admin).functions.test1(),
      expectedArgs: { _a: 1 },
    });

    await runROMethod({
      method: newCoreFacetFromCore.connect(admin).functions.test2(),
      expectedArgs: { _a: pilgrimMetaNFT.address },
    });

    await runRWMethod({
      method: newCoreFacetFromCore.connect(admin).functions.test3(invalidNftAddr),
      name: 'Test3',
      expectedArgs: { _b: invalidNftAddr },
    });
  });

  /* Add - Negative Cases */
  // Add a function from the zero address
  it('SHARED_010103', async function (): Promise<void> {
    const selectors = [test1Selector, test2Selector];
    const cuts = [
      {
        facetAddress: zeroAddr,
        action: FacetCutAction.Add,
        functionSelectors: selectors,
      },
    ];

    await runRWMethod({
      method: diamondCutFacet.connect(admin).diamondCut(cuts, zeroAddr, []),
      name: 'DiamondCut',
      expectRevert: true,
    });
  });

  // Add a function from an invalid contract
  it('SHARED_010104', async function (): Promise<void> {
    const selectors = [test1Selector, test2Selector];
    const cuts = [
      {
        facetAddress: invalidNftAddr,
        action: FacetCutAction.Add,
        functionSelectors: selectors,
      },
    ];

    await runRWMethod({
      method: diamondCutFacet.connect(admin).diamondCut(cuts, zeroAddr, []),
      name: 'DiamondCut',
      expectRevert: true,
    });
  });

  // Add a function selector that already exists
  it('SHARED_010105', async function (): Promise<void> {
    const selectors = [listSelector];
    const cuts = [
      {
        facetAddress: newCoreFacet.address,
        action: FacetCutAction.Add,
        functionSelectors: selectors,
      },
    ];

    await runRWMethod({
      method: diamondCutFacet.connect(admin).diamondCut(cuts, zeroAddr, []),
      name: 'DiamondCut',
      expectRevert: true,
    });
  });

  // Add no function selectors
  it('SHARED_010106', async function (): Promise<void> {
    const selectors: BytesLike[] = [];
    const cuts = [
      {
        facetAddress: newCoreFacet.address,
        action: FacetCutAction.Add,
        functionSelectors: selectors,
      },
    ];

    await runRWMethod({
      method: diamondCutFacet.connect(admin).diamondCut(cuts, zeroAddr, []),
      name: 'DiamondCut',
      expectRevert: true,
    });
  });

  /* Replace - Positive Cases */
  // Replace functions in an existing facet
  it('SHARED_010107', async function (): Promise<void> {
    const selectors = [listSelector, quoteNftSelector];
    const cuts = [
      {
        facetAddress: newCoreFacet.address,
        action: FacetCutAction.Replace,
        functionSelectors: selectors,
      },
    ];

    await diamondCutFacet.connect(admin).diamondCut(cuts, zeroAddr, []);

    await runRWMethod({
      method: listingFacet
        .connect(user1)
        .list(testERC721.address, tokenId, listingPrice, testERC20.address, [], dummyIpfsHash),
      name: 'List',
      expectedArgs: {
        _nftAddress: zeroAddr,
        _tokenId: tokenId,
      },
    });

    await runROMethod({
      method: listingFacet.connect(user1).functions.quoteNft(0),
      expectedArgs: {
        _amountIn: 100,
        _amountToMNftHolder: 100,
        _amountToRHolderPR: 100,
      },
    });

    await runROMethod({
      method: newCoreFacetFromCore.connect(user1).functions.quoteNft(0),
      expectedArgs: {
        _amountIn: 100,
        _amountToMNftHolder: 100,
        _amountToRHolderPR: 100,
      },
    });
  });

  /* Replace - Negative Cases */
  // Replace a function in the zero address
  it('SHARED_010108', async function (): Promise<void> {
    const selectors = [listSelector];
    const cuts = [
      {
        facetAddress: zeroAddr,
        action: FacetCutAction.Replace,
        functionSelectors: selectors,
      },
    ];

    await runRWMethod({
      method: diamondCutFacet.connect(admin).diamondCut(cuts, zeroAddr, []),
      name: 'DiamondCut',
      expectRevert: true,
    });
  });

  // Replace a function in a non-existing facet
  it('SHARED_010109', async function (): Promise<void> {
    const selectors = [listSelector];
    const cuts = [
      {
        facetAddress: invalidNftAddr,
        action: FacetCutAction.Replace,
        functionSelectors: selectors,
      },
    ];

    await runRWMethod({
      method: diamondCutFacet.connect(admin).diamondCut(cuts, zeroAddr, []),
      name: 'DiamondCut',
      expectRevert: true,
    });
  });

  // Replace a function in the same facet
  it('SHARED_010110', async function (): Promise<void> {
    const selectors = [listSelector];
    const cuts = [
      {
        facetAddress: coreCuts._diamondCut[2].facetAddress,
        action: FacetCutAction.Replace,
        functionSelectors: selectors,
      },
    ];

    await runRWMethod({
      method: diamondCutFacet.connect(admin).diamondCut(cuts, zeroAddr, []),
      name: 'DiamondCut',
      expectRevert: true,
    });
  });

  // Replace a function selector that doesn't exist
  it('SHARED_010111', async function (): Promise<void> {
    const selectors = [invalidSelector];
    const cuts = [
      {
        facetAddress: newCoreFacet.address,
        action: FacetCutAction.Replace,
        functionSelectors: selectors,
      },
    ];

    await runRWMethod({
      method: diamondCutFacet.connect(admin).diamondCut(cuts, zeroAddr, []),
      name: 'DiamondCut',
      expectRevert: true,
    });
  });

  // Replace no function selectors
  it('SHARED_010112', async function (): Promise<void> {
    const selectors: BytesLike[] = [];
    const cuts = [
      {
        facetAddress: newCoreFacet.address,
        action: FacetCutAction.Replace,
        functionSelectors: selectors,
      },
    ];

    await runRWMethod({
      method: diamondCutFacet.connect(admin).diamondCut(cuts, zeroAddr, []),
      name: 'DiamondCut',
      expectRevert: true,
    });
  });

  /* Remove - Positive Cases */
  // Remove functions in an existing facet
  it('SHARED_010113', async function (): Promise<void> {
    const selectors = [listSelector, quoteNftSelector];
    const cuts = [
      {
        facetAddress: zeroAddr,
        action: FacetCutAction.Remove,
        functionSelectors: selectors,
      },
    ];

    await diamondCutFacet.connect(admin).diamondCut(cuts, zeroAddr, []);

    await runRWMethod({
      method: listingFacet
        .connect(user1)
        .list(testERC721.address, tokenId, listingPrice, testERC20.address, [], dummyIpfsHash),
      name: 'List',
      expectRevert: true,
    });

    await runROMethod({
      method: listingFacet.connect(user1).functions.quoteNft(0),
      expectRevert: true,
    });
  });

  /* Remove - Negative Cases */
  // Remove functions with non-zero _facetAddress
  it('SHARED_010114', async function (): Promise<void> {
    const selectors = [listSelector, quoteNftSelector];
    const cuts = [
      {
        facetAddress: coreCuts._diamondCut[2].facetAddress,
        action: FacetCutAction.Remove,
        functionSelectors: selectors,
      },
    ];

    await runRWMethod({
      method: diamondCutFacet.connect(admin).diamondCut(cuts, zeroAddr, []),
      name: 'DiamondCut',
      expectRevert: true,
    });
  });

  // Remove a function selector that doesn't exist
  it('SHARED_010115', async function (): Promise<void> {
    const selectors = [invalidSelector];
    const cuts = [
      {
        facetAddress: zeroAddr,
        action: FacetCutAction.Remove,
        functionSelectors: selectors,
      },
    ];

    await runRWMethod({
      method: diamondCutFacet.connect(admin).diamondCut(cuts, zeroAddr, []),
      name: 'DiamondCut',
      expectRevert: true,
    });
  });

  // Remove no function selector
  it('SHARED_010116', async function (): Promise<void> {
    const selectors: BytesLike[] = [];
    const cuts = [
      {
        facetAddress: zeroAddr,
        action: FacetCutAction.Remove,
        functionSelectors: selectors,
      },
    ];

    await runRWMethod({
      method: diamondCutFacet.connect(admin).diamondCut(cuts, zeroAddr, []),
      name: 'DiamondCut',
      expectRevert: true,
    });
  });
});
