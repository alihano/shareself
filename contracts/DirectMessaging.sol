// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./Errors.sol";

/// @notice Gates DM access behind a flat 1 USDC unlock fee, split 50/50 between the
///         creator being messaged and the platform. Message content itself is off-chain
///         (this contract only tracks paid access); creator earnings accumulate here and
///         are pulled via `withdrawEarnings` rather than pushed on every unlock, so a
///         creator's receive path can never block someone else's unlock.
contract DirectMessaging is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint256 private constant BPS_DENOMINATOR = 10_000;
    uint256 public constant CREATOR_SHARE_BPS = 5_000; // 50%
    uint256 public constant UNLOCK_FEE = 1e6; // 1 USDC, 6 decimals

    IERC20 public immutable usdc;
    address public platformFeeRecipient;

    /// @notice payer => creator => unlocked.
    mapping(address payer => mapping(address creator => bool unlocked)) public hasAccessTo;

    /// @notice Creator earnings accrued from unlocks, withdrawable at any time.
    mapping(address creator => uint256 amount) public earningsOf;

    event ChatUnlocked(address indexed payer, address indexed creator, uint256 creatorShare, uint256 platformShare);
    event EarningsWithdrawn(address indexed creator, uint256 amount);
    event PlatformFeeRecipientUpdated(address indexed recipient);

    constructor(address _usdc, address _platformFeeRecipient) Ownable(msg.sender) {
        if (_usdc == address(0)) revert ZeroAddress();
        if (_platformFeeRecipient == address(0)) revert ZeroAddress();
        usdc = IERC20(_usdc);
        platformFeeRecipient = _platformFeeRecipient;
    }

    /// @notice Pays the flat unlock fee to gain `msg.sender` DM access to `creator`.
    function unlockChat(address creator) external nonReentrant {
        if (creator == address(0)) revert ZeroAddress();
        if (creator == msg.sender) revert SelfMessagingNotAllowed();
        if (hasAccessTo[msg.sender][creator]) revert ChatAlreadyUnlocked(msg.sender, creator);

        hasAccessTo[msg.sender][creator] = true;

        usdc.safeTransferFrom(msg.sender, address(this), UNLOCK_FEE);

        uint256 creatorShare = (UNLOCK_FEE * CREATOR_SHARE_BPS) / BPS_DENOMINATOR;
        uint256 platformShare = UNLOCK_FEE - creatorShare;

        earningsOf[creator] += creatorShare;
        usdc.safeTransfer(platformFeeRecipient, platformShare);

        emit ChatUnlocked(msg.sender, creator, creatorShare, platformShare);
    }

    /// @notice Withdraws all of `msg.sender`'s accrued creator earnings.
    function withdrawEarnings() external nonReentrant {
        uint256 amount = earningsOf[msg.sender];
        if (amount == 0) revert NothingToWithdraw();

        earningsOf[msg.sender] = 0;
        usdc.safeTransfer(msg.sender, amount);

        emit EarningsWithdrawn(msg.sender, amount);
    }

    /// @notice Updates the address that receives the platform's 50% unlock share. Owner-only.
    function setPlatformFeeRecipient(address newRecipient) external onlyOwner {
        if (newRecipient == address(0)) revert ZeroAddress();
        platformFeeRecipient = newRecipient;
        emit PlatformFeeRecipientUpdated(newRecipient);
    }
}
