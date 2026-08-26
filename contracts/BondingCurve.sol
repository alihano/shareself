// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./Errors.sol";

/// @notice Quadratic bonding curve pricing for ShareSelf user-profile shares.
/// @dev Per train.md, the marginal price of the next share at a given supply is
///      price(s) = s^2 * CURVE_CONSTANT / 1e18. getBuyPrice/getSellPrice integrate
///      that curve over a batch of shares using the closed-form sum-of-squares
///      identity (sum_{i=0}^{n-1} i^2 = (n-1) * n * (2n-1) / 6), so cost is computed
///      in O(1) with no on-chain loop. All returned prices are in USDC's 6 decimals.
library BondingCurve {
    /// @dev Tunable curve steepness. Paired with SocialFiPlatform's
    ///      CREATOR_PREMINT_BASIS so a fresh registration's marginal price lands
    ///      at $1 (see train.md's curve-tuning note) while keeping individual
    ///      trades a meaningful fraction of supply — that's what actually
    ///      controls how much a trade moves the price, not this constant alone
    ///      (a quadratic curve's price-elasticity is fixed at 2x regardless of
    ///      CURVE_CONSTANT). Adjust before any real (non-testnet) deployment.
    uint256 internal constant CURVE_CONSTANT = 1e18;

    /// @dev Hard ceiling on supply. Keeps `_sumOfSquares` comfortably inside uint256
    ///      range and makes the curve's overflow behavior explicit and testable,
    ///      rather than relying solely on Solidity 0.8's implicit revert-on-overflow.
    uint256 internal constant MAX_SUPPLY = 1_000_000_000;

    /// @notice Marginal price (USDC, 6 decimals) of the single next share at `supply`.
    function getPrice(uint256 supply) internal pure returns (uint256) {
        if (supply > MAX_SUPPLY) revert SupplyOverflow(supply, 0);
        return (supply * supply * CURVE_CONSTANT) / 1e18;
    }

    /// @notice USDC cost (6 decimals) to buy `amount` shares starting from `supply`.
    function getBuyPrice(uint256 supply, uint256 amount) internal pure returns (uint256) {
        if (amount == 0) revert ZeroAmount();
        if (supply + amount > MAX_SUPPLY) revert SupplyOverflow(supply, amount);

        uint256 sum = _sumOfSquares(supply + amount) - _sumOfSquares(supply);
        return (sum * CURVE_CONSTANT) / 1e18;
    }

    /// @notice USDC refund (6 decimals) for selling `amount` shares out of `supply`.
    function getSellPrice(uint256 supply, uint256 amount) internal pure returns (uint256) {
        if (amount == 0) revert ZeroAmount();
        if (amount > supply) revert InsufficientSupply(supply, amount);

        return getBuyPrice(supply - amount, amount);
    }

    /// @dev Closed-form sum_{i=0}^{n-1} i^2. Always an exact integer for integer n,
    ///      so no precision is lost when two calls are subtracted in getBuyPrice.
    function _sumOfSquares(uint256 n) private pure returns (uint256) {
        if (n == 0) return 0;
        return ((n - 1) * n * (2 * n - 1)) / 6;
    }
}
