// Arc Testnet's public RPC rate-limits eth_getLogs on concurrency, not just
// range size — a lone request with a 20,000-block range succeeded, but our
// app firing several getLogs calls at once (Promise.all across tokens/event
// types) tripped "rate limit exceeded" (see train.md). This serializes every
// RPC call routed through it, one at a time, with a minimum gap between
// dispatches, trading a bit of latency for not getting throttled.
const MIN_GAP_MS = 350;
let queueTail: Promise<void> = Promise.resolve();

export function throttledRpc<T>(fn: () => Promise<T>): Promise<T> {
  const result = queueTail.then(fn);
  queueTail = result.then(
    () => new Promise((resolve) => setTimeout(resolve, MIN_GAP_MS)),
    () => new Promise((resolve) => setTimeout(resolve, MIN_GAP_MS))
  );
  return result;
}
