import { Web3 } from 'web3'
import { sleep } from '../libs/sleep'
import { fetchBlockNumber } from '../main'

interface PollConfig {
  interval: number
  startAtBlock?: number
  shouldStop: (currentBlock: number, elapsed: number) => Promise<boolean>
  onAbort: (currentBlock: number, elapsed: number) => Promise<void>
}

export async function poll(web3: Web3, config: PollConfig): Promise<void> {
  let go = true
  let elapsed = 0
  let currentBlock = config.startAtBlock || 0
  while (go) {
    currentBlock = await fetchBlockNumber(web3)
    await sleep(config.interval)
    go = !(await config.shouldStop(currentBlock, elapsed))
    elapsed += config.interval
  }
  await config.onAbort(currentBlock, elapsed)
}