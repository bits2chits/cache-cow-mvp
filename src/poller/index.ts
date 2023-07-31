import { sleep } from '../libs/sleep';
import { fetchBlockNumber } from '../main';

interface PollConfig {
  interval: number;
  startAtBlock?: number;
  shouldStop: (currentBlock: number, elapsed: number) => Promise<boolean>;
  onAbort: (currentBlock: number, elapsed: number) => Promise<void>;
}

export async function poll(chain: string | symbol, config: PollConfig): Promise<void> {
  let go = true;
  let elapsed = 0;
  let currentBlock = config.startAtBlock || 0;
  while (go) {
    currentBlock = await fetchBlockNumber(chain);
    await sleep(config.interval);
    go = !(await config.shouldStop(currentBlock, elapsed));
    elapsed += config.interval;
  }
  await config.onAbort(currentBlock, elapsed);
}
