import UniswapV2Abi from '../../abis/uniswap-v2.json';
import { AbstractEvent } from './abstract-event';
import { LogDescription } from 'ethers';
import { PairPrice } from '../../continuous/price-processor/types';
import JSBI from 'jsbi';
import { Decimal } from 'decimal.js';
import { PairMetadata } from '../../server/pool-registry/types';

export class Sync extends AbstractEvent {
  constructor(address: string, pair: PairMetadata, log: LogDescription) {
    super(UniswapV2Abi, address, log);
    this.set('pair', pair);
    this.set('key', `${log.topic}:${address}`);
  }

  exponentialDecimals(decimals): JSBI {
    return JSBI.exponentiate(JSBI.BigInt(10), JSBI.BigInt(decimals))
  }

  toSignificant(amount: bigint, decimalsExp: JSBI): Decimal {
    return new Decimal(amount.toString())
      .div(decimalsExp.toString())
      .toSignificantDigits(5, Decimal.ROUND_HALF_UP)
  }

  calcPrice(): PairPrice {
    const pair: PairMetadata = this.get('pair')
    if (pair) {
      const scaledReserve0 = this.toSignificant(this.get('reserve0'), this.exponentialDecimals(pair.token0.decimals))
      const scaledReserve1 = this.toSignificant(this.get('reserve1'), this.exponentialDecimals(pair.token1.decimals))
      return {
        token0Price: scaledReserve0.dividedBy(scaledReserve1).toString(),
        token1Price: scaledReserve1.dividedBy(scaledReserve0).toString(),
      };
    } else {
      const reserve0: bigint = this.get('reserve0')
      const reserve1: bigint = this.get('reserve1');
      return {
        token0Price: (reserve0 / reserve1).toString(),
        token1Price: (reserve1 / reserve0).toString(),
      };
    }
  }

  toJSON(): object {
    return {
      key: this.get('key'),
      reserve0: this.get('reserve0').toString(),
      reserve1: this.get('reserve1').toString(),
      ...this.calcPrice(),
    };
  }

}
