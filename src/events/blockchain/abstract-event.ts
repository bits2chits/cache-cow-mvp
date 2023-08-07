import { AbiElement, AbiInputsElement } from './types';
import { Log, LogDescription } from 'ethers';
import JSBI from 'jsbi';
import { Decimal } from 'decimal.js';
import { PairMetadata } from '../../server/producers/types';

export abstract class AbstractEvent {
  abiElement: AbiElement;
  address: string;
  log: Log;
  parsedLog: LogDescription;

  protected constructor(abi: AbiElement[], pair: PairMetadata, log: Log, parsedLog: LogDescription) {
    this.log = log;
    this.parsedLog = parsedLog;
    for (const fragment of abi) {
      if (fragment.name === this.constructor.name
        && fragment.type === 'event'
        && fragment.inputs.length === this.parsedLog.args.length) {
        this.abiElement = fragment;
      }
    }
    if (!this.abiElement) {
      throw Error(`Invalid ABI passed to constructor. Ensure that the ABI has an event definition for event ${this.constructor.name} with ${this.parsedLog.args.length} arguments.`);
    }
    this.set('pair', pair);
    this.set('log', log);
    this.set('key', `${this.log.address}:${this.log.transactionHash}`);
    this.setLogValues();
  }

  get<T>(key: string): T {
    return this?.[key];
  }

  set<T>(key: string, value: T): void {
    this[key] = value;
  }

  setLogValues(): void {
    this.abiElement.inputs
      .forEach((currentValue: AbiInputsElement, currentIndex: number): void => {
        this.set(currentValue.name || currentIndex.toString(), this.parsedLog.args[currentIndex]);
      });
  }


  static exponentialDecimals(decimals: string | number): JSBI {
    return JSBI.exponentiate(JSBI.BigInt(10), JSBI.BigInt(decimals));
  }

  static toSignificant(amount: string | bigint | Decimal, decimalsExp: JSBI): Decimal {
    return new Decimal(amount.toString())
      .div(decimalsExp.toString())
      .toSignificantDigits(5, Decimal.ROUND_HALF_UP);
  }

  abstract toJSON(): object
}
