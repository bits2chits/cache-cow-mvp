import { EventEmitter } from "node:events"
import BaseEvents from "./base-emitter"
import { BlockError, BlockErrorListener, BlockEventsEnum, NewBlockListener } from "./types"
import {BlockData} from "../poller/block-processor/types";
import {Log} from "web3";

export class BlockEventEmitter extends EventEmitter {}

export default class BlockEvents extends BaseEvents<BlockEventsEnum, NewBlockListener | BlockErrorListener> {

  constructor() {
    super(new BlockEventEmitter())
  }

  newBlock(chain: string, blockNumber: number): void {
    this.emitter.emit(BlockEventsEnum['new-block'], chain, blockNumber)
  }

  blockData(chain: string, data: BlockData): void {
    this.emitter.emit(BlockEventsEnum['block-data'], chain, data)
  }

  logData(chain: string, topic: string, log: Log): void {
    this.emitter.emit(BlockEventsEnum[topic], chain, log)
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
