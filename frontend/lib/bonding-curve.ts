// JS/BigInt mirror of contracts/BondingCurve.sol, used to compute historical
// price points locally (from a trade's post-trade supply, read off event
// logs) without round-tripping to the chain for every point on a chart.
// CURVE_CONSTANT must be kept in sync with contracts/BondingCurve.sol by hand.
const CURVE_CONSTANT = 10n ** 18n;
// Was 200n (2%) — contracts/SocialFiPlatform.sol was bumped to 300 (3%) in a
// later change (see train.md's "Fee Değişiklikleri") but this mirror wasn't
// updated to match. That gap meant every frontend-computed maxCost/minReturn
// undershot the real on-chain cost by ~1%, which the 0.5% slippage buffer in
// TradeWidget.tsx couldn't cover — so every single buy reverted with
// CostExceedsMax, regardless of amount (confirmed by simulating buyToken
// directly against the live contract with a generous maxCost, which
// succeeded, while the app's own computed maxCost did not).
const BUY_FEE_BPS = 300n;
const SELL_FEE_BPS = 300n;
const BPS_DENOMINATOR = 10_000n;

function sumOfSquares(n: bigint): bigint {
  return n === 0n ? 0n : ((n - 1n) * n * (2n * n - 1n)) / 6n;
}

/** Marginal price (USDC, 6 decimals) of the next share at `supply`. */
export function getPrice(supply: bigint): bigint {
  return (supply * supply * CURVE_CONSTANT) / 10n ** 18n;
}

/** USDC cost (6 decimals) to buy `amount` shares starting from `supply`. */
export function getBuyPrice(supply: bigint, amount: bigint): bigint {
  const sum = sumOfSquares(supply + amount) - sumOfSquares(supply);
  return (sum * CURVE_CONSTANT) / 10n ** 18n;
}

/** USDC refund (6 decimals) for selling `amount` shares out of `supply`. */
export function getSellPrice(supply: bigint, amount: bigint): bigint {
  return getBuyPrice(supply - amount, amount);
}

/** Total USDC cost (price + 3% fee) to buy `amount` shares at `supply`. */
export function quoteBuy(supply: bigint, amount: bigint): bigint {
  const price = getBuyPrice(supply, amount);
  return price + (price * BUY_FEE_BPS) / BPS_DENOMINATOR;
}

/** Net USDC payout (price - 3% fee) to sell `amount` shares at `supply`. */
export function quoteSell(supply: bigint, amount: bigint): bigint {
  const price = getSellPrice(supply, amount);
  return price - (price * SELL_FEE_BPS) / BPS_DENOMINATOR;
}
