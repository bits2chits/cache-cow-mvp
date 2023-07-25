import {LogDescription} from "ethers"
import {AbiElement, AbiInputsElement} from "../Types"

export abstract class AbstractEvent {
  abiElement: AbiElement
  log: LogDescription

  constructor(abi: AbiElement[], log: LogDescription) {
    this.abiElement = abi.find((fragment: AbiElement) =>
      fragment.name === this.constructor.name
      && fragment.type === "event"
      && fragment.inputs.length === this.log.args.length
    )
    this.log = log
    this.setLogValues()
  }

  setLogValues(): void {
    this.abiElement.inputs
      .forEach((currentValue: AbiInputsElement, currentIndex: number): void => {
        this[currentValue.name || currentIndex] = this.log.args[currentIndex]
      })
  }

}
