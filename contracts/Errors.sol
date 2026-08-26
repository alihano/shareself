// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Custom errors shared across ShareSelf's contracts (gas-cheaper and more
///         legible than require(string), per train.md's contract rules).

/// @notice Thrown when a required address argument is the zero address.
error ZeroAddress();

/// @notice Thrown when a required amount argument is zero.
error ZeroAmount();

/// @notice Thrown when `supply + amount` would exceed the curve's supported range.
error SupplyOverflow(uint256 supply, uint256 amount);

/// @notice Thrown when trying to sell more shares than currently exist.
error InsufficientSupply(uint256 supply, uint256 amount);

/// @notice Thrown when a username fails the 3-20 character length rule.
error InvalidUsername(string username);

/// @notice Thrown when `registerUser` is called for a username already taken.
error UsernameTaken(string username);

/// @notice Thrown when `registerUser` is called by an address that already has a token.
error UserAlreadyRegistered(address user);

/// @notice Thrown when an address passed as a user/creator has no registered token.
error UserNotRegistered(address user);

/// @notice Thrown when a token address passed to the platform was not created by it.
error UnknownToken(address token);

/// @notice Thrown when a buy's actual USDC cost exceeds the caller's supplied cap.
error CostExceedsMax(uint256 cost, uint256 maxCost);

/// @notice Thrown when a sell's actual USDC return is below the caller's supplied floor.
error ReturnBelowMin(uint256 amountOut, uint256 minReturn);

/// @notice Thrown when a caller tries to buy or sell their own creator token in a way
///         that's disallowed (kept for future rule use; unused if self-trading is allowed).
error Unauthorized();

/// @notice Thrown when a chat-unlock or withdrawal is attempted with nothing to act on.
error NothingToWithdraw();

/// @notice Thrown when a creator tries to unlock chat access with themselves.
error SelfMessagingNotAllowed();

/// @notice Thrown when a message-unlock is attempted twice for the same pair.
error ChatAlreadyUnlocked(address payer, address creator);
