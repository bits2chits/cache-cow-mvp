import {AbiElement, AbiInputsElement} from "./types"
import {LogDescription} from "ethers"
import JSBI from 'jsbi';
import { Decimal } from 'decimal.js';

export abstract class AbstractEvent {
  abiElement: AbiElement
  address: string
  log: LogDescription

  protected constructor(abi: AbiElement[], address: string, log: LogDescription) {
    this.log = log
    for (const fragment of abi) {
      if (fragment.name === this.constructor.name
        && fragment.type === "event"
        && fragment.inputs.length === this.log.args.length) {
        this.abiElement = fragment
      }
    }
    if (!this.abiElement) {
      throw Error(`Invalid ABI passed to constructor. Ensure that the ABI has an event definition for event ${this.constructor.name} with ${this.log.args.length} arguments.`)
    }
    this.setLogValues()
  }

  get<T>(key: string): T {
    return this?.[key]
  }

  set<T>(key: string, value: T): void {
    this[key] = value
  }

  setLogValues(): void {
    this.abiElement.inputs
      .forEach((currentValue: AbiInputsElement, currentIndex: number): void => {
        this.set(currentValue.name || currentIndex.toString(), this.log.args[currentIndex])
      })
  }


  static exponentialDecimals(decimals: string | number): JSBI {
    return JSBI.exponentiate(JSBI.BigInt(10), JSBI.BigInt(decimals))
  }

  static toSignificant(amount: string | bigint | Decimal, decimalsExp: JSBI): Decimal {
    return new Decimal(amount.toString())
      .div(decimalsExp.toString())
      .toSignificantDigits(5, Decimal.ROUND_HALF_UP)
  }

  abstract toJSON(): object
}
