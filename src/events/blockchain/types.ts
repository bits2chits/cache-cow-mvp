import { Decimal } from 'decimal.js';

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

export interface Reserves {
  reserve0: Decimal | string;
  reserve1: Decimal | string;
  poolSize?: number;
}

export interface Key {
  key: string;
}

export type CalculatedReserves = PairPrice & Reserves & Key
