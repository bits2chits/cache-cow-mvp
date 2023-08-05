import { CalculatedReserves, CalculatedReservesUniswapV3 } from '../../events/blockchain/types';
import { PoolDeltas } from '../block-processor/types';

export type FrontendPriceEntries = [string, CalculatedReserves | CalculatedReservesUniswapV3][]

export type FrontendPoolDeltas = [string, PoolDeltas][]
export interface SocketEvents {
  prices: (priceUpdates: FrontendPriceEntries) => void;
  deltas: (poolDeltas: FrontendPoolDeltas) => void;
  pairs: (pairs: string[]) => void;
  filter: (filters: string[]) => void;
  hello: () => void;
}


