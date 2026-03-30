// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title VerseToken
 * @notice ERC-20 token with bonding curve minting for Proof of Creativity.
 *
 * Supply model: Bonding curve — price rises as totalSupply grows.
 * Formula: price = BASE_PRICE + SLOPE * (totalSupply / 1e18)²
 *
 * Three ways to get $VERSE:
 * 1. Claim from influence scores (free, verified via Merkle proof)
 * 2. Buy on the bonding curve (pay ETH)
 * 3. Earn via bounties (marketplace)
 */
contract VerseToken is ERC20, Ownable {
    // Bonding curve parameters
    uint256 public constant BASE_PRICE = 0.0001 ether;  // Starting price per token
    uint256 public constant SLOPE = 0.00000001 ether;    // Price increase per token²
    uint256 public constant SPREAD_BPS = 500;            // 5% spread on sells

    // Influence claim tracking
    address public influenceAnchor;
    mapping(bytes32 => bool) public claimed; // keccak256(epoch, nodeId, author) => claimed

    // Marketplace authorization
    address public marketplace;

    event TokensBought(address indexed buyer, uint256 amount, uint256 cost);
    event TokensSold(address indexed seller, uint256 amount, uint256 payout);
    event InfluenceClaimed(address indexed author, uint256 epoch, string nodeId, uint256 amount);
    event InfluenceAnchorSet(address indexed anchor);
    event MarketplaceSet(address indexed marketplace);

    constructor() ERC20("Verse", "VERSE") Ownable(msg.sender) {}

    // --- Bonding Curve ---

    /// @notice Current price per token on the bonding curve
    function currentPrice() public view returns (uint256) {
        uint256 supply = totalSupply() / 1e18; // Normalize to whole tokens
        return BASE_PRICE + (SLOPE * supply * supply);
    }

    /// @notice How many tokens you get for a given ETH amount
    function tokensForEth(uint256 ethAmount) public view returns (uint256) {
        uint256 price = currentPrice();
        return (ethAmount * 1e18) / price;
    }

    /// @notice Buy tokens on the bonding curve
    function buy() external payable {
        require(msg.value > 0, "Send ETH to buy");
        uint256 amount = tokensForEth(msg.value);
        require(amount > 0, "Amount too small");

        _mint(msg.sender, amount);
        emit TokensBought(msg.sender, amount, msg.value);
    }

    /// @notice Sell tokens back to the curve (with spread)
    function sell(uint256 amount) external {
        require(amount > 0, "Amount must be > 0");
        require(balanceOf(msg.sender) >= amount, "Insufficient balance");

        uint256 price = currentPrice();
        uint256 grossPayout = (amount * price) / 1e18;
        uint256 payout = grossPayout - (grossPayout * SPREAD_BPS / 10000);

        require(address(this).balance >= payout, "Insufficient contract balance");

        _burn(msg.sender, amount);
        payable(msg.sender).transfer(payout);
        emit TokensSold(msg.sender, amount, payout);
    }

    // --- Influence Claims ---

    /// @notice Set the InfluenceAnchor contract address
    function setInfluenceAnchor(address _anchor) external onlyOwner {
        influenceAnchor = _anchor;
        emit InfluenceAnchorSet(_anchor);
    }

    /// @notice Set the Marketplace contract address
    function setMarketplace(address _marketplace) external onlyOwner {
        marketplace = _marketplace;
        emit MarketplaceSet(_marketplace);
    }

    /// @notice Claim $VERSE from a verified influence score
    /// @param epoch The epoch number
    /// @param nodeId The verse node ID (e.g., "v1")
    /// @param score The influence score (18 decimals, e.g., 14.35 = 14350000000000000000)
    /// @param proof Merkle proof from the epoch snapshot
    function claimInfluence(
        uint256 epoch,
        string calldata nodeId,
        uint256 score,
        bytes32[] calldata proof
    ) external {
        require(influenceAnchor != address(0), "Anchor not set");

        bytes32 claimKey = keccak256(abi.encodePacked(epoch, nodeId, msg.sender));
        require(!claimed[claimKey], "Already claimed");

        // Verify against InfluenceAnchor
        (bool valid, ) = influenceAnchor.staticcall(
            abi.encodeWithSignature(
                "verifyScore(uint256,string,uint256,bytes32[])",
                epoch, nodeId, score, proof
            )
        );
        require(valid, "Invalid proof");

        claimed[claimKey] = true;

        // Mint tokens: score * 100 (the projection formula from the UI)
        uint256 amount = score * 100;
        _mint(msg.sender, amount);

        emit InfluenceClaimed(msg.sender, epoch, nodeId, amount);
    }

    /// @notice Mint tokens for bounty rewards (only callable by marketplace)
    function mintForBounty(address recipient, uint256 amount) external {
        require(msg.sender == marketplace, "Only marketplace");
        _mint(recipient, amount);
    }

    /// @notice Allow contract to receive ETH (for bonding curve liquidity)
    receive() external payable {}
}
