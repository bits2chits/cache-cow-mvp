import { EventEmitter } from "node:events"
import BaseEvents from "./base-emitter"

export enum BlockEventsEnum {
  ['new-block'] = 'new-block',
  ['block-error'] = 'block-error'
}

export type NewBlockListener = (chain: string, blockNumber: number) => void | Promise<void>

export type BlockErrorListener = (error: BlockError) => void | Promise<void>

export interface BlockEventListener {
  event: BlockEventsEnum
  listener: NewBlockListener | BlockErrorListener
}

export class BlockEventEmitter extends EventEmitter {}

export class BlockError extends Error {}

export default class BlockEvents extends BaseEvents<BlockEventsEnum, NewBlockListener | BlockErrorListener> {

  constructor() {
    super(new BlockEventEmitter())
  }

  newBlock(chain: string, blockNumber: number): void {
    console.log(BlockEventsEnum['new-block'], chain, blockNumber)
    this.emitter.emit(BlockEventsEnum['new-block'], chain, blockNumber)
  }

  blockError(chain: string, message: string): void {
    this.emitter.emit(BlockEventsEnum['block-error'], new BlockError(`Error with block on ${chain} chain. ${message}`))
  }

  onNewBlock(cb: NewBlockListener): void {
    this.emitter.on(BlockEventsEnum['new-block'], cb)
    this.listeners.push({ event: BlockEventsEnum['new-block'], listener: cb })
  }

  onBlockError(cb: BlockErrorListener): void {
    this.emitter.on(BlockEventsEnum['block-error'], cb)
    this.listeners.push({ event: BlockEventsEnum['block-error'], listener: cb })
  }
}