import { ProcessorInterface } from "./types"
import { sleep } from "../libs/sleep"

export default abstract class BaseProcessor implements ProcessorInterface {
  protected running: boolean

  constructor() {
    this.initialize()
      .catch(console.error)
  }

  async initialize(): Promise<void> {
    // @TODO some initialization stuff
    this.running = true
    while (this.running) {
      await sleep(1000)
    }
  }

  async shutdown(): Promise<void> {
    this.running = false
  }
}
