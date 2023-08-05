import UniswapV2Abi from '../../abis/uniswap-v2.json';
import { AbstractEvent } from './abstract-event';
import { LogDescription } from 'ethers';
import { PairMetadata } from '../../server/pool-registry/types';
import { CalculatedReserves, EventSignature, PairPrice } from './types';
import { Decimal } from 'decimal.js';

export class Sync extends AbstractEvent {
  constructor(address: string, pair: PairMetadata, log: LogDescription) {
    super(UniswapV2Abi, address, log);
    this.set('pair', pair);
    this.set('key', `${log.topic}:${address}`);
  }

  calcPrice(): PairPrice {
    const pair: PairMetadata = this.get('pair');
    const reserve0 = new Decimal(this.get('reserve0').toString())
      .div(new Decimal(10).pow(new Decimal(pair.token0.decimals.toString())));
    const reserve1 = new Decimal(this.get('reserve1').toString())
      .div(new Decimal(10).pow(new Decimal(pair.token1.decimals.toString())));

    const token0Price = reserve0.div(reserve1)
    const token1Price = reserve1.div(reserve0)

    return {
      token0Price: token0Price.toSignificantDigits(5, Decimal.ROUND_HALF_UP),
      token1Price: token1Price.toSignificantDigits(5, Decimal.ROUND_HALF_UP),
    };
  }

  toJSON(): CalculatedReserves {
    return {
      key: this.get('key'),
      eventSignature: EventSignature.Sync,
      reserve0: this.get('reserve0').toString(),
      reserve1: this.get('reserve1').toString(),
      ...this.calcPrice(),
    };
  }

}
