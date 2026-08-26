// Arc Testnet's public RPC rate-limits eth_getLogs on concurrency, not just
// range size — a lone request with a 20,000-block range succeeded, but our
// app firing several getLogs calls at once (Promise.all across tokens/event
// types) tripped "rate limit exceeded" (see train.md). This serializes every
// RPC call routed through it, one at a time, with a minimum gap between
// dispatches, trading a bit of latency for not getting throttled.
const MIN_GAP_MS = 350;

// Found via production diagnostics: an eth_getLogs call querying near the
// live chain tip occasionally never resolves or rejects at all — not a slow
// response, a genuine hang past viem's own configured transport timeout
// (10s) and retry budget. Without this wrapper, that single hung `fn()`
// leaves `queueTail` permanently pending, since `queueTail = result.then(...)`
// can't fire until `result` settles — so *every* future call on this same
// warm serverless instance chains onto a promise that will never resolve
// and hangs forever too, forever, even for completely unrelated requests.
// Racing every call against a hard deadline guarantees `result` always
// settles (as a rejection, worst case), so the queue can never get wedged.
const CALL_TIMEOUT_MS = 15_000;

function withHardTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`throttledRpc: call exceeded ${ms}ms hard timeout`)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

let queueTail: Promise<void> = Promise.resolve();

export function throttledRpc<T>(fn: () => Promise<T>): Promise<T> {
  const result = queueTail.then(() => withHardTimeout(fn(), CALL_TIMEOUT_MS));
  queueTail = result.then(
    () => new Promise((resolve) => setTimeout(resolve, MIN_GAP_MS)),
    () => new Promise((resolve) => setTimeout(resolve, MIN_GAP_MS))
  );
  return result;
}
