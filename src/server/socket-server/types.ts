import { CalculatedReserves } from '../../events/blockchain/types';
import { PoolDeltas } from '../block-processor/types';

export type FrontendPriceEntries = [string, CalculatedReserves][]

export type FrontendPoolDeltas = [string, PoolDeltas][]
export interface SocketEvents {
  prices: (priceUpdates: FrontendPriceEntries) => void;
  deltas: (poolDeltas: FrontendPoolDeltas) => void;
  pairs: (pairs: Set<string>) => void;
  filter: (filters: string[]) => void;
  hello: () => void;
}


