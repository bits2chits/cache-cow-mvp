export interface Reserves {
  _reserve0: bigint;
  _reserve1: bigint;
  _blockTimestampLast: bigint;
}


export interface Pair {
  token0: string;
  token1: string;
}

export interface PairPrice {
  token0Price: number;
  token1Price: number;
}
