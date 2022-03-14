import BN from 'bignumber.js';
import { BigNumber, BigNumberish } from 'ethers';

// Defaults to e18 using amount * 10^18
export function getBigNumber(amount: string | number, decimals = 18) {
  return BigNumber.from(amount).mul(BigNumber.from(10).pow(decimals));
}
export const bigNumber1 = getBigNumber('1');

// returns the sqrt price as a 64x96
export function encodePriceSqrt(reserve1: BigNumberish, reserve0: BigNumberish): BigNumber {
  return BigNumber.from(
    new BN(reserve1.toString())
      .div(reserve0.toString())
      .sqrt()
      .multipliedBy(new BN(2).pow(96))
      .integerValue(3)
      .toFixed(),
  );
}

export enum FeeAmount {
  LOW = 500,
  MEDIUM = 3000,
  HIGH = 10000,
}

export const TICK_SPACINGS: { [amount in FeeAmount]: number } = {
  [FeeAmount.LOW]: 10,
  [FeeAmount.MEDIUM]: 60,
  [FeeAmount.HIGH]: 200,
};

export const getMinTick = (tickSpacing: number) => Math.ceil(-887272 / tickSpacing) * tickSpacing;
export const getMaxTick = (tickSpacing: number) => Math.floor(887272 / tickSpacing) * tickSpacing;
