import UniswapV3Abi from '../../abis/uniswap-v3.json';
import { AbstractEvent } from './abstract-event';
import { Log, LogDescription } from 'ethers';
import { PairMetadata } from '../../server/pool-registry/types';
import { CalculatedReserves, EventSignature, PairPrice } from './types';
import { Decimal } from 'decimal.js';

const Q96 = new Decimal(2).pow(new Decimal(96));
const Q192 = Q96.pow(new Decimal(2));

export class Swap extends AbstractEvent {
  constructor(address: string, pair: PairMetadata, log: Log, parsedLog: LogDescription) {
    super(UniswapV3Abi, address, pair, log, parsedLog);
  }


  calcPrice(): PairPrice {
    const pair: PairMetadata = this.get('pair');

    const sqrtPriceX96 = new Decimal(this.get('sqrtPriceX96').toString());
    const token0ExponentialDecimals = new Decimal(AbstractEvent.exponentialDecimals(pair.token0.decimals).toString());
    const token1ExponentialDecimals = new Decimal(AbstractEvent.exponentialDecimals(pair.token1.decimals).toString());

    const inputNumerator = sqrtPriceX96.mul(sqrtPriceX96);
    const decimalAdjustedNumerator = token1ExponentialDecimals.mul(Q192);
    const decimalAdjustedDenominator = token0ExponentialDecimals.mul(inputNumerator);

    const token0Price = decimalAdjustedNumerator.div(decimalAdjustedDenominator);
    const token1Price = decimalAdjustedDenominator.div(decimalAdjustedNumerator);

    return {
      token0Price: token0Price.toSignificantDigits(5, Decimal.ROUND_HALF_UP),
      token1Price: token1Price.toSignificantDigits(5, Decimal.ROUND_HALF_UP),
    };
  }

  toJSON(): CalculatedReserves {
    return {
      key: this.get('key'),
      log: this.get('log'),
      eventSignature: EventSignature.SwapV3,
      sqrtPriceX96: this.get('sqrtPriceX96').toString(),
      ...this.calcPrice(),
    };
  }

}
