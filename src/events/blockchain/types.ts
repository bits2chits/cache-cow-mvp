import { Decimal } from 'decimal.js';
import { Log, LogDescription } from 'ethers';
import { PairMetadata } from '../../server/producers/types';

export enum EventSignature {
  Sync = 'Sync(uint112,uint112)',
  SwapV3 = 'Swap(address,address,int256,int256,uint160,uint128,int24)',
  PairCreated = 'PairCreated(address,address,address,uint256)'
}

export interface EventArgs {
  pair: PairMetadata;
  log: Log;
  parsedLog: LogDescription;
}


export interface AbiInputsElement {
  indexed?: boolean;
  internalType: string;
  name: string;
  type: string;
}

export interface AbiElement {
  inputs: AbiInputsElement[],
  payable?: boolean
  stateMutability?: string
  type: string
  anonymous?: boolean
  name?: string
  constant?: boolean
  outputs?: AbiInputsElement[]
}

export interface PairPrice {
  token0Price: Decimal | string;
  token1Price: Decimal | string;
}

export interface ReservesUniswapV2 {
  reserve0?: Decimal | string;
  reserve1?: Decimal | string;
}

export interface ReservesUniswapV3 {
  sqrtPriceX96?: Decimal | string;
}

export interface ReservesMetadata {
  token0?: string;
  token1?: string;
  poolSize?: number;
  updated?: Date;
}

export interface Metadata {
  key: string;
  eventSignatures?: EventSignature[];
  log?: Log;
}

export type CalculatedReservesBase = PairPrice & ReservesMetadata & Metadata

export type CalculatedReserves = CalculatedReservesBase & ReservesUniswapV2 & ReservesUniswapV3
