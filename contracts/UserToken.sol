// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./Errors.sol";

/// @notice ERC20 representing tradeable shares in one ShareSelf user's profile.
/// @dev One instance is deployed per registered user by SocialFiPlatform, which is
///      set as `owner` and is the only account allowed to mint or burn shares.
///      Bonding-curve pricing (BondingCurve.sol) and USDC handling live in
///      SocialFiPlatform, not here — this contract stays a simple, auditable,
///      access-controlled share ledger.
contract UserToken is ERC20, Ownable {
    /// @notice The username this share token represents.
    string public username;

    /// @notice The user this share token was issued for.
    address public immutable creator;

    /// @param _username Display username backing this token (3-20 chars, enforced by
    ///        SocialFiPlatform at registration).
    /// @param _creator Wallet address of the registering user.
    /// @param _platform SocialFiPlatform address; becomes `owner` and the sole
    ///        mint/burn caller.
    /// @dev No creator premint: an earlier version minted free starting shares to the
    ///      creator, but those shares had no USDC backing while still being sellable
    ///      against SocialFiPlatform's single pooled reserve — a zero-capital drain of
    ///      other users' deposits (found in a security review, see train.md). Supply now
    ///      starts at zero and only ever grows via SocialFiPlatform.buyToken, which is
    ///      always paid, so every unit of supply is always reserve-backed.
    constructor(
        string memory _username,
        address _creator,
        address _platform
    )
        ERC20(string.concat(_username, " Shares"), string.concat("S-", _username))
        Ownable(_platform)
    {
        // Note: _platform == address(0) is already rejected by Ownable's own
        // constructor (OwnableInvalidOwner) before this body runs, so it isn't
        // re-checked here.
        if (_creator == address(0)) revert ZeroAddress();

        username = _username;
        creator = _creator;
    }

    /// @notice Shares are whole, indivisible units (friend.tech-style) — BondingCurve
    ///         and SocialFiPlatform both operate on raw integer supply, so this
    ///         overrides ERC20's default of 18 to keep wallets/explorers from
    ///         displaying balances scaled by 1e18.
    function decimals() public pure override returns (uint8) {
        return 0;
    }

    /// @notice Mints `amount` shares to `to`. Only callable by SocialFiPlatform.
    function mint(address to, uint256 amount) external onlyOwner {
        if (to == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();
        _mint(to, amount);
    }

    /// @notice Burns `amount` shares from `from`. Only callable by SocialFiPlatform.
    function burn(address from, uint256 amount) external onlyOwner {
        if (amount == 0) revert ZeroAmount();
        _burn(from, amount);
    }
}
