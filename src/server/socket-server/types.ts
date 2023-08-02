import { PairMetadata } from '../pool-registry/types';

export interface PricesMap {
  [key: string]: {
    [key: string]: TokenPrices
  }
}

export type FrontendPriceEntries = [string, { [p: string]: TokenPrices }][]

export interface SocketEvents {
  prices: (priceUpdates: FrontendPriceEntries) => void;
  pairs: (pairs: PairMetadata[]) => void;
  filter: (filters: string[]) => void;
  hello: () => void;
}

export interface TokenPrices {
  pair: string;
  token0Price: number;
  token1Price: number;
}
