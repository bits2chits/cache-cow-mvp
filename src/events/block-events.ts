import { EventEmitter } from "node:events"
import BaseEvents from "./base-emitter"
import { BlockError, BlockErrorListener, BlockEventsEnum, NewBlockListener } from "./types"

export class BlockEventEmitter extends EventEmitter {}

export default class BlockEvents extends BaseEvents<BlockEventsEnum, NewBlockListener | BlockErrorListener> {

  constructor() {
    super(new BlockEventEmitter())
  }

  newBlock(chain: string, blockNumber: number): void {
    this.emitter.emit(BlockEventsEnum['new-block'], chain, blockNumber)
  }

  blockError(chain: string, message: string): void {
    this.emitter.emit(BlockEventsEnum['block-error'], new BlockError(`Error with block on ${chain} chain. ${message}`))
  }

  onNewBlock(cb: NewBlockListener): void {
    this.on(BlockEventsEnum['new-block'], cb)
  }

  onBlockError(cb: BlockErrorListener): void {
    this.on(BlockEventsEnum['block-error'], cb)
  }
}