// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title VerseToken
 * @notice ERC-20 token with bonding curve minting for Proof of Creativity.
 *
 * Supply model: Bonding curve — price rises as totalSupply grows.
 * Formula: price = BASE_PRICE + SLOPE * (totalSupply / 1e18)²
 * Buy/sell use numerical integration for correct pricing.
 */
contract VerseToken is ERC20, Ownable, ReentrancyGuard {
    // Bonding curve parameters
    uint256 public constant BASE_PRICE = 0.0001 ether;  // Starting price per token
    uint256 public constant SLOPE = 0.00000001 ether;    // Price increase per token²
    uint256 public constant SPREAD_BPS = 500;            // 5% spread on sells
    uint256 public constant MAX_CLAIM_PER_EPOCH = 100000 * 1e18; // Max claimable per epoch

    // Influence claim tracking
    address public influenceAnchor;
    mapping(bytes32 => bool) public claimed; // keccak256(epoch, nodeId, claimer) => claimed

    // Marketplace authorization
    address public marketplace;

    event TokensBought(address indexed buyer, uint256 amount, uint256 cost);
    event TokensSold(address indexed seller, uint256 amount, uint256 payout);
    event InfluenceClaimed(address indexed author, uint256 epoch, string nodeId, uint256 amount);
    event InfluenceAnchorSet(address indexed anchor);
    event MarketplaceSet(address indexed marketplace);

    constructor() ERC20("Verse", "VERSE") Ownable(msg.sender) {}

    // --- Bonding Curve (Integral-Based) ---

    /// @notice Spot price at a given supply level
    function priceAtSupply(uint256 supply) public pure returns (uint256) {
        uint256 s = supply / 1e18; // Normalize to whole tokens
        return BASE_PRICE + (SLOPE * s * s);
    }

    /// @notice Current spot price (for display only — buy/sell use integrals)
    function currentPrice() public view returns (uint256) {
        return priceAtSupply(totalSupply());
    }

    /// @notice Cost to buy `amount` tokens at current supply (integral of price curve)
    function costToBuy(uint256 amount) public view returns (uint256) {
        return _integralCost(totalSupply(), totalSupply() + amount);
    }

    /// @notice Payout for selling `amount` tokens (integral, minus spread)
    function payoutForSell(uint256 amount) public view returns (uint256) {
        require(amount <= totalSupply(), "Amount exceeds supply");
        uint256 gross = _integralCost(totalSupply() - amount, totalSupply());
        return gross - (gross * SPREAD_BPS / 10000);
    }

    /// @notice Integral of price function from s0 to s1 (in token wei)
    /// integral(BASE_PRICE + SLOPE * s^2) ds = BASE_PRICE * (s1-s0) + SLOPE * (s1^3 - s0^3) / 3
    function _integralCost(uint256 s0, uint256 s1) internal pure returns (uint256) {
        uint256 n0 = s0 / 1e18;
        uint256 n1 = s1 / 1e18;
        uint256 diff = n1 - n0;
        uint256 linearPart = BASE_PRICE * diff;
        uint256 cubicPart = SLOPE * (n1 * n1 * n1 - n0 * n0 * n0) / 3;
        return linearPart + cubicPart;
    }

    /// @notice Buy tokens on the bonding curve with slippage protection
    function buy(uint256 minTokensOut) external payable nonReentrant {
        require(msg.value > 0, "Send ETH to buy");

        // Binary search for amount of tokens that costs msg.value
        uint256 lo = 0;
        uint256 hi = msg.value * 1e18 / BASE_PRICE * 2; // Upper bound estimate
        if (hi == 0) hi = 1e18;

        while (hi - lo > 1e15) { // Precision: 0.001 tokens
            uint256 mid = (lo + hi) / 2;
            uint256 cost = _integralCost(totalSupply(), totalSupply() + mid);
            if (cost <= msg.value) {
                lo = mid;
            } else {
                hi = mid;
            }
        }

        uint256 amount = lo;
        require(amount > 0, "Amount too small");
        require(amount >= minTokensOut, "Slippage exceeded");

        _mint(msg.sender, amount);

        // Refund excess ETH
        uint256 actualCost = _integralCost(totalSupply() - amount, totalSupply());
        if (msg.value > actualCost) {
            (bool refunded, ) = payable(msg.sender).call{value: msg.value - actualCost}("");
            require(refunded, "Refund failed");
        }

        emit TokensBought(msg.sender, amount, actualCost);
    }

    /// @notice Sell tokens back to the curve with slippage protection
    function sell(uint256 amount, uint256 minPayout) external nonReentrant {
        require(amount > 0, "Amount must be > 0");
        require(balanceOf(msg.sender) >= amount, "Insufficient balance");

        uint256 payout = payoutForSell(amount);
        require(payout >= minPayout, "Slippage exceeded");
        require(address(this).balance >= payout, "Insufficient contract balance");

        _burn(msg.sender, amount);
        (bool success, ) = payable(msg.sender).call{value: payout}("");
        require(success, "ETH transfer failed");

        emit TokensSold(msg.sender, amount, payout);
    }

    // --- Influence Claims ---

    function setInfluenceAnchor(address _anchor) external onlyOwner {
        influenceAnchor = _anchor;
        emit InfluenceAnchorSet(_anchor);
    }

    function setMarketplace(address _marketplace) external onlyOwner {
        marketplace = _marketplace;
        emit MarketplaceSet(_marketplace);
    }

    /// @notice Claim $VERSE from a verified influence score
    /// @param epoch The epoch number
    /// @param nodeId The verse node ID (e.g., "v1")
    /// @param score The influence score (18 decimals)
    /// @param proof Merkle proof from the epoch snapshot
    function claimInfluence(
        uint256 epoch,
        string calldata nodeId,
        uint256 score,
        bytes32[] calldata proof
    ) external nonReentrant {
        require(influenceAnchor != address(0), "Anchor not set");

        // Claim key includes score to prevent re-claiming with different scores
        bytes32 claimKey = keccak256(abi.encode(epoch, nodeId, msg.sender, score));
        require(!claimed[claimKey], "Already claimed");

        // Verify against InfluenceAnchor — properly decode the return value
        (bool success, bytes memory data) = influenceAnchor.staticcall(
            abi.encodeWithSignature(
                "verifyScore(uint256,string,address,uint256,bytes32[])",
                epoch, nodeId, msg.sender, score, proof
            )
        );
        require(success, "Verification call failed");
        bool isValid = abi.decode(data, (bool));
        require(isValid, "Invalid proof");

        claimed[claimKey] = true;

        // Mint tokens: score * 100, capped per epoch
        uint256 amount = score * 100;
        require(amount <= MAX_CLAIM_PER_EPOCH, "Exceeds max claim");
        _mint(msg.sender, amount);

        emit InfluenceClaimed(msg.sender, epoch, nodeId, amount);
    }

    /// @notice Mint tokens for bounty rewards (only callable by marketplace)
    function mintForBounty(address recipient, uint256 amount) external {
        require(msg.sender == marketplace, "Only marketplace");
        _mint(recipient, amount);
    }

    receive() external payable {}
}
