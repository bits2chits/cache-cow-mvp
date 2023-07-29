import { EventEmitter } from "node:events"
import BaseEvents from "./base-emitter"
import {
  BlockDataListener,
  BlockError,
  BlockErrorListener,
  BlockEventsEnum,
  LogDataListener,
  NewBlockListener
} from "./types"
import {BlockData} from "../poller/block-processor/types"
import {Log} from "web3"
import {singleton} from 'tsyringe'

export class BlockEventEmitter extends EventEmitter {}

@singleton()
export default class BlockEvents extends BaseEvents<BlockEventsEnum, NewBlockListener | BlockDataListener | LogDataListener | BlockErrorListener> {

  constructor() {
    super(new BlockEventEmitter())
  }

  newBlock(chain: string, blockNumber: number): void {
    this.emitter.emit(BlockEventsEnum['new-block'], chain, blockNumber)
  }

  blockData(chain: string, block: BlockData): void {
    this.emitter.emit(BlockEventsEnum['block-data'], chain, block)
  }

  logData(chain: string, log: Log): void {
    this.emitter.emit(BlockEventsEnum['log-data'], chain, log)
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

  onBlockData(cb: BlockDataListener): void {
    this.on(BlockEventsEnum['block-data'], cb)
  }

  onLogData(cb: LogDataListener): void {
    this.on(BlockEventsEnum['log-data'], cb)
  }
}
