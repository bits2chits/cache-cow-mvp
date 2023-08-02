import { CalculatedReserves } from '../../events/blockchain/types';

export type FrontendPriceEntries = [string, CalculatedReserves][]

export interface SocketEvents {
  prices: (priceUpdates: FrontendPriceEntries) => void;
  pairs: (pairs: string[]) => void;
  filter: (filters: string[]) => void;
  hello: () => void;
}


