// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./Errors.sol";
import "./BondingCurve.sol";
import "./UserToken.sol";

/// @notice ShareSelf's main controller: registers users (deploying a UserToken per
///         registration), and runs bonding-curve buy/sell trades against that token.
/// @dev Reserve model (friend.tech-style): a buy's pre-fee cost stays in this contract
///      as USDC reserve backing that token's supply; a sell pays that reserve back out.
///      The 3% fee on each side is skimmed immediately (never added to the reserve, so
///      reserve accounting stays exactly symmetric with BondingCurve's
///      getBuyPrice/getSellPrice), split 50/50 between the traded token's creator
///      (`creatorOfToken[token]`) and `platformFeeRecipient` — pushed directly via
///      safeTransfer rather than accrued like DirectMessaging's earnings, since a plain
///      ERC20 transfer can't call back into the recipient the way a native-ETH send can,
///      so there's no reentrancy/DoS reason to make creators pull it (see train.md).
///      All USDC amounts are 6 decimals (train.md) — this contract never touches the
///      18-decimal native gas token.
contract SocialFiPlatform is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint256 private constant BPS_DENOMINATOR = 10_000;
    uint256 public constant BUY_FEE_BPS = 300; // 3%
    uint256 public constant SELL_FEE_BPS = 300; // 3%

    /// @dev How the BUY_FEE_BPS/SELL_FEE_BPS fee splits between the traded token's
    ///      creator and the platform (see train.md's "Fee Değişiklikleri" note).
    uint256 public constant CREATOR_FEE_SHARE_BPS = 5_000; // 50%

    /// @dev Reference supply passed to each UserToken for sizing the 10% creator
    ///      premint (see UserToken.sol). Not a circulating-supply ceiling itself.
    ///      Sized (paired with BondingCurve.CURVE_CONSTANT) so a single trade is
    ///      a meaningful fraction of supply and visibly moves the price — see
    ///      train.md's curve-tuning note; the original 1_000_000 made price
    ///      swings feel too flat for typical trade sizes.
    uint256 public constant CREATOR_PREMINT_BASIS = 10_000;

    IERC20 public immutable usdc;
    address public platformFeeRecipient;

    mapping(string username => address token) public tokenOf;
    mapping(address user => address token) public tokenOfUser;
    mapping(address token => address creator) public creatorOfToken;
    mapping(address token => bool) public isPlatformToken;

    event UserRegistered(address indexed user, string username, address indexed token);
    event TokensBought(address indexed buyer, address indexed token, uint256 amount, uint256 cost, uint256 fee);
    event TokensSold(address indexed seller, address indexed token, uint256 amount, uint256 proceeds, uint256 fee);
    event PlatformFeeRecipientUpdated(address indexed recipient);

    constructor(address _usdc, address _platformFeeRecipient) Ownable(msg.sender) {
        if (_usdc == address(0)) revert ZeroAddress();
        if (_platformFeeRecipient == address(0)) revert ZeroAddress();
        usdc = IERC20(_usdc);
        platformFeeRecipient = _platformFeeRecipient;
    }

    /// @notice Registers `msg.sender` under `username`, deploying their UserToken and
    ///         preminting 10% of `CREATOR_PREMINT_BASIS` to them.
    function registerUser(string calldata username) external nonReentrant returns (address token) {
        if (tokenOfUser[msg.sender] != address(0)) revert UserAlreadyRegistered(msg.sender);

        uint256 len = bytes(username).length;
        if (len < 3 || len > 20) revert InvalidUsername(username);
        if (tokenOf[username] != address(0)) revert UsernameTaken(username);

        UserToken newToken = new UserToken(username, msg.sender, address(this), CREATOR_PREMINT_BASIS);
        token = address(newToken);

        tokenOf[username] = token;
        tokenOfUser[msg.sender] = token;
        creatorOfToken[token] = msg.sender;
        isPlatformToken[token] = true;

        emit UserRegistered(msg.sender, username, token);
    }

    /// @notice Buys `amount` shares of `token` for `msg.sender`, paying USDC pulled via
    ///         `transferFrom` (caller must approve this contract first). Reverts if the
    ///         total cost (price + 3% fee) exceeds `maxCost`. The fee splits 50/50
    ///         between the token's creator and the platform.
    function buyToken(address token, uint256 amount, uint256 maxCost) external nonReentrant {
        if (!isPlatformToken[token]) revert UnknownToken(token);
        if (amount == 0) revert ZeroAmount();

        UserToken userToken = UserToken(token);
        uint256 supply = userToken.totalSupply();
        uint256 price = BondingCurve.getBuyPrice(supply, amount);
        uint256 fee = (price * BUY_FEE_BPS) / BPS_DENOMINATOR;
        uint256 totalCost = price + fee;
        if (totalCost > maxCost) revert CostExceedsMax(totalCost, maxCost);

        usdc.safeTransferFrom(msg.sender, address(this), totalCost);
        _distributeFee(token, fee);

        userToken.mint(msg.sender, amount);

        emit TokensBought(msg.sender, token, amount, totalCost, fee);
    }

    /// @notice Sells `amount` shares of `token` held by `msg.sender` back to the curve.
    ///         Reverts if the net payout (price minus 3% fee) is below `minReturn`. The
    ///         fee splits 50/50 between the token's creator and the platform.
    function sellToken(address token, uint256 amount, uint256 minReturn) external nonReentrant {
        if (!isPlatformToken[token]) revert UnknownToken(token);
        if (amount == 0) revert ZeroAmount();

        UserToken userToken = UserToken(token);
        uint256 supply = userToken.totalSupply();
        uint256 price = BondingCurve.getSellPrice(supply, amount);
        uint256 fee = (price * SELL_FEE_BPS) / BPS_DENOMINATOR;
        uint256 payout = price - fee;
        if (payout < minReturn) revert ReturnBelowMin(payout, minReturn);

        userToken.burn(msg.sender, amount);

        _distributeFee(token, fee);
        usdc.safeTransfer(msg.sender, payout);

        emit TokensSold(msg.sender, token, amount, payout, fee);
    }

    /// @dev Splits a buy/sell `fee` 50/50 between `token`'s creator and the platform.
    function _distributeFee(address token, uint256 fee) private {
        if (fee == 0) return;
        uint256 creatorFee = (fee * CREATOR_FEE_SHARE_BPS) / BPS_DENOMINATOR;
        uint256 platformFee = fee - creatorFee;
        if (creatorFee > 0) usdc.safeTransfer(creatorOfToken[token], creatorFee);
        if (platformFee > 0) usdc.safeTransfer(platformFeeRecipient, platformFee);
    }

    /// @notice Snapshot of a registered user's token: address, supply, and current
    ///         marginal price (USDC, 6 decimals) for the next share.
    function getUserInfo(address user)
        external
        view
        returns (address token, uint256 totalSupply, uint256 currentPrice)
    {
        token = tokenOfUser[user];
        if (token == address(0)) revert UserNotRegistered(user);

        totalSupply = UserToken(token).totalSupply();
        currentPrice = BondingCurve.getPrice(totalSupply);
    }

    /// @notice Quotes the total USDC cost (price + fee) to buy `amount` shares of `token`.
    function quoteBuy(address token, uint256 amount) external view returns (uint256 totalCost) {
        if (!isPlatformToken[token]) revert UnknownToken(token);
        uint256 price = BondingCurve.getBuyPrice(UserToken(token).totalSupply(), amount);
        totalCost = price + (price * BUY_FEE_BPS) / BPS_DENOMINATOR;
    }

    /// @notice Quotes the net USDC payout (price minus fee) to sell `amount` shares of `token`.
    function quoteSell(address token, uint256 amount) external view returns (uint256 payout) {
        if (!isPlatformToken[token]) revert UnknownToken(token);
        uint256 price = BondingCurve.getSellPrice(UserToken(token).totalSupply(), amount);
        payout = price - (price * SELL_FEE_BPS) / BPS_DENOMINATOR;
    }

    /// @notice Updates the address that receives buy/sell fees. Owner-only.
    function setPlatformFeeRecipient(address newRecipient) external onlyOwner {
        if (newRecipient == address(0)) revert ZeroAddress();
        platformFeeRecipient = newRecipient;
        emit PlatformFeeRecipientUpdated(newRecipient);
    }
}
