import {jest} from '@jest/globals'
import { MATIC_USDC } from '../src/enums/pairs'
import { fetchBlockNumber } from '../src/main'
import { Web3 } from 'web3'
import { poll } from '../src/poller'

jest.setTimeout(30000)

describe('Tests poller', () => {
  const web3 = new Web3(MATIC_USDC.RPC)
  it('fetch latest block number', async () => {
    const blockNumber = await fetchBlockNumber(web3)
    await poll(web3, {
      interval: 500,
      startAtBlock: blockNumber,
      shouldStop: async (block) => {
        return block > blockNumber
      },
      onAbort: async (block, interval) => {
        console.log(`This is how many time it took: ${interval}`)
        expect(block).toBeGreaterThan(blockNumber)
        expect(interval).toBeGreaterThanOrEqual(500)
      }
    })
  })
})
