import { ProcessorInterface } from "./types"
import { sleep } from "../libs/sleep"

export default abstract class BaseProcessor implements ProcessorInterface {
  protected running: boolean

  protected constructor() {
    // We shouldn't call an async process here, it'll result in inconsistencies
    // with super vs this being created. We can perhaps make use of a static constructor?
  }

  abstract initialize(): Promise<void>

  protected async start(): Promise<void> {
    this.running = true
    while (this.running) {
      await sleep(1000)
    }
  }

  async shutdown(): Promise<void> {
    this.running = false
  }
}
