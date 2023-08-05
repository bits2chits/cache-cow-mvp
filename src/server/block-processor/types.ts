import { CalculatedReserves } from '../../events/blockchain/types';
import { Decimal } from 'decimal.js';

export interface MultiPoolPricesMap {
  [key: string]: CalculatedReserves  | PricesMapWithDeltas
}

export interface PricesMap {
  [key: string]: CalculatedReserves
}

export interface CalculatedReservesWithPoolAddress {
  poolAddress: string;
  reserves: CalculatedReserves
}

export interface PoolDeltas {
  largestDelta0: CalculatedReservesWithPoolAddress
  largestDelta1: CalculatedReservesWithPoolAddress
  smallestDelta0: CalculatedReservesWithPoolAddress
  smallestDelta1: CalculatedReservesWithPoolAddress
  delta0: Decimal
  delta1: Decimal
}

export interface PricesMapWithDeltas {
  [key: string]: CalculatedReserves & PoolDeltas
}
