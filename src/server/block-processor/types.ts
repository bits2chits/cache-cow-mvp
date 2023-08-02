import { CalculatedReserves } from '../../events/blockchain/types';

export interface MultiPoolPricesMap {
  [key: string]: PricesMap
}

export interface PricesMap {
  [key: string]: CalculatedReserves
}
