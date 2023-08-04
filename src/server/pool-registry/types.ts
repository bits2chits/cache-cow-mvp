export interface PairMetadata {
  pair: string;
  token0: Erc20Metadata;
  token1: Erc20Metadata;
}

export interface Erc20Metadata {
  address: string;
  symbol: string;
  decimals: number;
}
