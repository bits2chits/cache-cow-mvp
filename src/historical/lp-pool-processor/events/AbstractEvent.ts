import {LogDescription} from "ethers"
import {AbiElement, AbiInputsElement} from "../Types"

export abstract class AbstractEvent {
  abiElement: AbiElement
  log: LogDescription

  protected constructor(abi: AbiElement[], log: LogDescription) {
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

  setLogValues(): void {
    this.abiElement.inputs
      .forEach((currentValue: AbiInputsElement, currentIndex: number): void => {
        this[currentValue.name || currentIndex] = this.log.args[currentIndex]
      })
  }
}
