import UniswapFactoryAbi from '../../abis/uniswap-factory.json';
import { AbstractEvent } from './abstract-event';
import { Log, LogDescription } from 'ethers';
import { PairMetadata } from '../../server/producers/types';

export class PairCreated extends AbstractEvent {

  constructor(pair: PairMetadata, log: Log, parsedLog: LogDescription) {
    super(UniswapFactoryAbi, pair, log, parsedLog);
  }

  // Not in use currently.
  override toJSON(): object {
    return {
      key: this.get('key'),
      token0: this.get('token0'),
      token0Symbol: this.get('token0Symbol'),
      token0Decimals: this.get('token0Decimals'),
      token1: this.get('token1'),
      token1Symbol: this.get('token1Symbol'),
      token1Decimals: this.get('token1Decimals'),
      pair: this.get('pair'),
      poolIndex: this.get('poolIndex'),
    };
  }
}
