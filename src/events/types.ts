import {BlockData} from "../poller/block-processor/types";
import {Log} from "web3";

export enum BaseEventsEnum {}

export interface BaseEventListener<EventsEnum, Listener extends (...args: any[]) => void> {
  event: EventsEnum | (string | symbol)
  listener: Listener
}

export class BaseError extends Error {}

export enum BlockEventsEnum {
  ['new-block'] = 'new-block',
  ['block-error'] = 'block-error'
}

export type NewBlockListener = (chain: string, blockNumber: number) => void | Promise<void>
export type BlockDataListener = (chain: string, blockData: BlockData) => void | Promise<void>
export type LogDataListener = (chain: string, topic: string, blockData: Log) => void | Promise<void>

export class BlockError extends Error {}

export type BlockErrorListener = (error: BlockError) => void | Promise<void>

export interface BlockEventListener {
  event: BlockEventsEnum
  listener: NewBlockListener | BlockErrorListener
}
