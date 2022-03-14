/* eslint-disable max-classes-per-file */
import BN from 'bignumber.js';
import { assert, expect } from 'chai';
import {
  BigNumber,
  BigNumberish,
  Contract,
  ContractReceipt,
  ContractTransaction,
  providers,
  Signer,
  utils,
} from 'ethers';
import { Result } from 'ethers/lib/utils';
import { network } from 'hardhat';

import {
  AMMFacet,
  ERC20Mock,
  ERC721Mock,
  LibDistribution__factory,
} from '../typechain';

export const oneEther: BigNumber = BigNumber.from(10).pow(18);
export const microEther: BigNumber = BigNumber.from(10).pow(12);
export const roundUnit: BigNumber = microEther.mul(10);
export const zeroAddr: string = '0x0000000000000000000000000000000000000000';
export const invalidNftAddr: string = '0x0000000000000000000000000000000000000001';
export const overdueDeadline: number = Math.floor(Date.now() / 1000);
export const initialEtherRounds: BigNumberish = 10000;
export const maxInitPrice: BigNumber = BigNumber.from(2).pow(128).sub(1).div(initialEtherRounds);
export const deadline: number = 999_999_999_999_999;
export const dummyIpfsHash: string = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';
export const listingPrice: BigNumber = oneEther.div(100);

export const zeroEther: BigNumber = BigNumber.from(0);
export const tenPercent: BigNumber = oneEther.mul(1000);
export const twentyPercent: BigNumber = oneEther.mul(2000);
export const thirtyPercent: BigNumber = oneEther.mul(3000);
export const hundredPercent: BigNumber = oneEther.mul(10000);
export const billionEther: BigNumber = oneEther.mul(1_000_000_000);

export const emptyTagArr: string[] = [];

export const f0: BigNumber = zeroEther;
export const f10: BigNumber = microEther.mul(11_070_138);
export const f20: BigNumber = microEther.mul(24_591_235);
export const f30: BigNumber = microEther.mul(41_105_940);

export const df10To20: BigNumber = microEther.mul(13_521_097);
export const df10To30: BigNumber = microEther.mul(30_035_802);
export const df20To30: BigNumber = microEther.mul(16_514_705);

export const g0: BigNumber = oneEther.mul(100);
export const g10: BigNumber = microEther.mul(122_140_276);
export const g20: BigNumber = microEther.mul(149_182_470);
export const g30: BigNumber = microEther.mul(182_211_880);

export const baseFeeNumerator = BigNumber.from(1);
export const baseFeeDenominator = BigNumber.from(1000);
export const roundFeeNumerator = BigNumber.from(4);
export const roundFeeDenominator = BigNumber.from(1000);
export const nftFeeNumerator = BigNumber.from(25);
export const nftFeeDenominator = BigNumber.from(1000);

export const defaultBidTimeOut = 6 * 60 * 60;
export const minBidTimeOut = 1;

function sqrt(value: BigNumber): BigNumber {
  return BigNumber.from(new BN(value.toString()).sqrt().toFixed().split('.')[0]);
}

function divCeil(numerator: BigNumber, denominator: BigNumber): BigNumber {
  return numerator.add(denominator).sub(1).div(denominator);
}

function beforeFee(n: BigNumber, feeNumerator: BigNumber, feeDenominator: BigNumber): BigNumber {
  return n.add(divCeil(n, feeDenominator.sub(feeNumerator)).mul(feeNumerator));
}

function afterFee(n: BigNumber, feeNumerator: BigNumber, feeDenominator: BigNumber): BigNumber {
  return n.sub(divCeil(n, feeDenominator).mul(feeNumerator));
}

export function beforeBaseFee(n: BigNumber, ceil: boolean = true) {
  const temp = beforeFee(n, baseFeeNumerator, baseFeeDenominator);
  return ceil ? divCeil(temp, microEther).mul(microEther) : temp;
}

export function afterBaseFee(n: BigNumber, ceil: boolean = true) {
  const temp = afterFee(n, baseFeeNumerator, baseFeeDenominator);
  return ceil ? divCeil(temp, microEther).mul(microEther) : temp;
}

export function beforeRoundFee(n: BigNumber) {
  return beforeFee(n.div(roundUnit), roundFeeNumerator, roundFeeDenominator).mul(roundUnit);
}

export function afterRoundFee(n: BigNumber) {
  return afterFee(n.div(roundUnit), roundFeeNumerator, roundFeeDenominator).mul(roundUnit);
}

export function beforeNftFee(n: BigNumber, ceil: boolean = true) {
  const temp = beforeFee(n, nftFeeNumerator, nftFeeDenominator);
  return ceil ? divCeil(temp, microEther).mul(microEther) : temp;
}

export function afterNftFee(n: BigNumber, ceil: boolean = true) {
  const temp = afterFee(n, nftFeeNumerator, nftFeeDenominator);
  return ceil ? divCeil(temp, microEther).mul(microEther) : temp;
}

export const g0MetaNFT: BigNumber = g0.add(f0);
export const g10MetaNFT: BigNumber = g10.add(f10);
export const g20MetaNFT: BigNumber = g20.add(f20);
export const g30MetaNFT: BigNumber = g30.add(f30);

export const g0NFT: BigNumber = g0.mul(1);
export const g10NFT: BigNumber = g10.mul(11).div(10);
export const g20NFT: BigNumber = g20.mul(12).div(10);
export const g30NFT: BigNumber = g30.mul(13).div(10);

export const g0Delist: BigNumber = g0.mul(0);
export const g10Delist: BigNumber = g10.mul(1).div(10).sub(f10);
export const g20Delist: BigNumber = g20.mul(2).div(10).sub(f20);
export const g30Delist: BigNumber = g30.mul(3).div(10).sub(f30);

export const g0RHolderPR: BigNumber = g0.div(initialEtherRounds);
export const g10RHolderPR: BigNumber = g10Delist.add(f10).div(10).div(100);
export const g20RHolderPR: BigNumber = g20Delist.add(f20).div(20).div(100);
export const g30RHolderPR: BigNumber = g30Delist.add(f30).div(30).div(100);

export function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function getApproxTimeOut(contract: Contract, timeOut: number) {
  const { provider } = contract;
  const timeNow = (await provider.getBlock(await provider.getBlockNumber())).timestamp;
  return (timeNow + timeOut) | 0;
}

export async function sleepTimestamp(provider: providers.Provider, timestamp: number) {
  let timeNow: number;
  const aim: number = (await provider.getBlock(await provider.getBlockNumber())).timestamp + timestamp;
  do {
    await sleep(100);
    timeNow = (await provider.getBlock(await provider.getBlockNumber())).timestamp;
  } while (timeNow < aim);
}

export function getEventArgs(txReceipt: ContractReceipt, eventName: string, iface?: utils.Interface) {
  if (txReceipt.events !== undefined) {
    for (const _event of txReceipt.events) {
      if (iface !== undefined && (_event.event === undefined || _event.args === undefined)) {
        try {
          const parsedLog = iface.parseLog(_event);
          _event.event = parsedLog.name;
          _event.args = parsedLog.args;
        } catch {}
      }
      if (_event.event === eventName) {
        if (_event.args === undefined) {
          assert.fail('event.args is undefined');
        }
        return _event.args;
      }
    }
    assert.fail(`Can not find ${eventName} from txReceipt`);
    throw new Error(`Can not find ${eventName} from txReceipt`);
  }
  assert.fail('txReceipt.events is undefined');
  throw new Error('txReceipt.events is undefined');
}

export async function mintNft(erc721: ERC721Mock, to: Signer): Promise<BigNumber> {
  const mintReceipt: ContractReceipt = await (
    await erc721.safeMint(await to.getAddress())
  ).wait();
  const { tokenId } = getEventArgs(mintReceipt, 'Transfer')!;
  return tokenId;
}

export function numberWithCommas(x: BigNumber) {
  return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

export function checkArgs(
  eventName: string,
  txArgs: Result,
  expectedArgs: { [arg: string]: any },
  expectExact: boolean,
): { [arg: string]: any } {
  const argsCasted: { [arg: string]: any } = {};
  let log: string = '------------------------------------------------------------\n'
    + `Result of ${eventName}\n\n`;

  for (const arg of Object.keys(txArgs)) {
    if (BigNumber.isBigNumber(arg)) continue;

    if (BigNumber.isBigNumber(txArgs[arg]) && !Array.isArray(txArgs[arg])) {
      argsCasted[arg] = BigNumber.from(txArgs[arg]);
      // eslint-disable-next-line no-prototype-builtins
      if (!expectedArgs.hasOwnProperty(arg)) continue;
      expectedArgs[arg] = BigNumber.from(expectedArgs[arg]);

      log
        += `Argument: ${arg}\n`
        + `Expect: ${numberWithCommas(expectedArgs[arg])}\n`
        + `Actual: ${numberWithCommas(argsCasted[arg])}\n\n`;

      if (expectExact) {
        expect(argsCasted[arg], log).to.deep.equal(expectedArgs[arg]);
      } else {
        expect(argsCasted[arg], log).to.be.at.least(expectedArgs[arg].sub(microEther));
        expect(argsCasted[arg], log).to.be.at.most(
          expectedArgs[arg].add(microEther),
        );
      }
    } else if (typeof txArgs[arg] === 'object' && Array.isArray(txArgs[arg])) {
      // TODO: make it recursive in the future
      argsCasted[arg] = {};
      for (const innerArg of Object.keys(txArgs[arg])) {
        if (BigNumber.isBigNumber(innerArg)) continue;
        if (BigNumber.isBigNumber(txArgs[arg][innerArg])) {
          argsCasted[arg][innerArg] = BigNumber.from(txArgs[arg][innerArg]);

          // eslint-disable-next-line no-prototype-builtins
          if (!expectedArgs[arg].hasOwnProperty(innerArg)) continue;
          expectedArgs[arg][innerArg] = BigNumber.from(
            expectedArgs[arg][innerArg],
          );
        } else {
          argsCasted[arg][innerArg] = txArgs[arg][innerArg];
        }
      }
      // eslint-disable-next-line no-prototype-builtins
      if (!expectedArgs.hasOwnProperty(arg)) continue;
      expect(argsCasted[arg], log).to.deep.equal(expectedArgs[arg]);
    } else {
      // TODO: nested arrays or arrays of complicated types/objects not supported
      argsCasted[arg] = txArgs[arg];

      // eslint-disable-next-line no-prototype-builtins
      if (!expectedArgs.hasOwnProperty(arg)) continue;

      log
        += `Argument: ${arg}\n`
        + `Expect: ${expectedArgs[arg]}\n`
        + `Actual: ${argsCasted[arg]}\n\n`;

      expect(argsCasted[arg], log).to.deep.equal(expectedArgs[arg]);
    }
  }

  return argsCasted;
}

interface ArgsRunROMethod {
  method: Promise<Result>;
  name?: string;
  expectedArgs?: { [arg: string]: any };
  expectRevert?: boolean;
  expectExact?: boolean;
  revertMsg?: string;
}

export async function runROMethod({
  method,
  name = 'Read-only',
  expectedArgs = {},
  expectRevert = false,
  expectExact = false,
  revertMsg = '',
}: ArgsRunROMethod): Promise<{ [arg: string]: any }> {
  if (expectRevert) {
    await expect(method).to.be.revertedWith(revertMsg);
    return {};
  }
  return checkArgs(name, await method, expectedArgs, expectExact);
}

export interface ArgsRunRWMethod {
  method: Promise<providers.TransactionResponse>;
  name: string;
  expectedArgs?: { [arg: string]: any };
  expectRevert?: boolean;
  expectExact?: boolean;
  revertMsg?: string;
}

export async function runRWMethod({
  method,
  name,
  expectedArgs = {},
  expectRevert = false,
  expectExact = false,
  revertMsg = '',
}: ArgsRunRWMethod): Promise<{ [arg: string]: any }> {
  if (expectRevert) {
    await expect(method).to.be.revertedWith(revertMsg);
    return {};
  }
  return checkArgs(
    name,
    getEventArgs(await (await method).wait(), name),
    expectedArgs,
    expectExact,
  );
}

export class TradingHelper {

  ammFacet: AMMFacet;
  metaNftId: BigNumberish;
  trader: Signer;
  testERC20: ERC20Mock;
  libDistIface: utils.Interface;

  constructor(
    ammFacet: AMMFacet,
    metaNftId: BigNumberish,
    trader: Signer,
    testERC20: ERC20Mock,
  ) {
    this.ammFacet = ammFacet;
    this.metaNftId = metaNftId;
    this.trader = trader;
    this.testERC20 = testERC20;
    this.libDistIface = LibDistribution__factory.createInterface();
  }

  async checkRewardEvents(tx: ContractTransaction) {
    const result = await tx.wait();
    checkArgs(
      'EarnPairReward',
      getEventArgs(result, 'EarnPairReward', this.libDistIface),
      { _metaNftId: this.metaNftId },
      true);
    checkArgs(
      'EarnUserReward',
      getEventArgs(result, 'EarnUserReward', this.libDistIface),
      { _metaNftId: this.metaNftId, _userAddress: await this.trader.getAddress() },
      true);
  }

  async buyRounds(
    amount: BigNumber,
    checkRewardEvents: boolean = false,
  ): Promise<BigNumber> {
    const quotedBaseIn = await this.ammFacet.quoteBuyExactRounds(
      this.metaNftId,
      amount,
    );
    await this.testERC20
      .connect(this.trader)
      .approve(this.ammFacet.address, quotedBaseIn);
    const tx = await this.ammFacet
      .connect(this.trader)
      .buyExactRoundsWithBases(
        this.metaNftId,
        quotedBaseIn,
        amount,
        deadline,
      );
    if (checkRewardEvents) {
      await this.checkRewardEvents(tx);
    }
    return quotedBaseIn;
  }

  async sellRounds(
    amount: BigNumber,
    checkRewardEvents: boolean = false,
  ): Promise<BigNumber> {
    const quotedBaseOut = await this.ammFacet.quoteSellExactRounds(
      this.metaNftId,
      amount,
    );
    const tx = await this.ammFacet
      .connect(this.trader)
      .sellExactRoundsWithBases(
        this.metaNftId,
        amount,
        quotedBaseOut,
        deadline,
      );
    if (checkRewardEvents) {
      await this.checkRewardEvents(tx);
    }
    return quotedBaseOut;
  }

}

export async function skipBlocks(n: number) {
  for (let i = 0; i < n; i++) {
    await network.provider.send('evm_mine');
  }
}

export function assertAlmostEqual(v1: BigNumber, v2: BigNumber) {
  const [min, max] = v2.gt(v1) ? [v1, v2] : [v2, v1];
  assert(max.sub(min).mul(100000000).lt(min));
}

export interface TokenPrice {
  numerator: BigNumberish;
  denominator: BigNumberish;
}

export class DistributionHelper {

  rewardParameter: BigNumberish;
  gasReward: BigNumberish;
  initialRounds: BigNumber;
  extraRewardParam: BigNumberish;
  baseTokenPrice: TokenPrice;

  constructor(
    rewardParamter: BigNumberish,
    gasReward: BigNumberish,
    initialRounds: BigNumber,
    extraRewardParam: BigNumberish,
    baseTokenPrice: TokenPrice | null = null,
  ) {
    this.rewardParameter = rewardParamter;
    this.gasReward = gasReward;
    this.initialRounds = initialRounds;
    this.extraRewardParam = extraRewardParam;
    if (baseTokenPrice === null) {
      this.baseTokenPrice = {
        numerator: 1,
        denominator: 1,
      };
    } else {
      this.baseTokenPrice = baseTokenPrice;
    }
  }

  calculateReward(
    minPairBaseReserve: BigNumber,
    tradingVolume: BigNumber,
    minRoundReserve: BigNumber,
    totalMintedRounds: BigNumber,
    addGasReward: boolean = false,
  ): BigNumber {
    return sqrt(minPairBaseReserve.mul(this.baseTokenPrice.numerator).div(this.baseTokenPrice.denominator).mul(oneEther))
      .mul(tradingVolume).mul(this.baseTokenPrice.numerator).div(this.baseTokenPrice.denominator)
      .div(this.rewardParameter)
      .mul(minRoundReserve)
      .div(this.initialRounds.add(totalMintedRounds))
      .div(oneEther)
      .mul(this.extraRewardParam)
      .add(addGasReward ? this.gasReward : 0);
  }

}

export function sortTokenAddrs(tokenA: string, tokenB: string): Array<string> {
  return tokenA.toLowerCase() < tokenB.toLowerCase() ? [tokenA, tokenB] : [tokenB, tokenA];
}
