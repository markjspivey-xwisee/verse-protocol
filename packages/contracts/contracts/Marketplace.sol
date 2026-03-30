// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title Marketplace
 * @notice Bounties, IP trading, revenue sharing, and governance for $VERSE.
 *
 * Four functions:
 * 1. Bounties — stake $VERSE on narrative affordances
 * 2. IP Trading — list/buy verse node ownership rights
 * 3. Revenue Sharing — set upstream royalty percentages
 * 4. Governance — propose and vote on protocol parameters
 */
contract Marketplace is Ownable {
    IERC20 public verseToken;

    // --- BOUNTIES ---

    struct Bounty {
        address poster;
        string parentNodeId;
        string requiredType;    // "Character", "Location", etc.
        string description;
        uint256 amount;
        bool claimed;
        address claimedBy;
        string fulfilledNodeId;
        uint256 createdAt;
        uint256 expiresAt;
    }

    uint256 public nextBountyId;
    mapping(uint256 => Bounty) public bounties;

    event BountyPosted(uint256 indexed bountyId, address poster, string parentNodeId, uint256 amount);
    event BountyClaimed(uint256 indexed bountyId, address claimedBy, string nodeId);
    event BountyExpired(uint256 indexed bountyId);

    // --- IP TRADING ---

    struct Listing {
        address owner;
        string nodeId;
        uint256 price;
        bool active;
        uint256 royaltyBps; // Basis points of future revenue to original creator
    }

    mapping(string => Listing) public listings;       // nodeId => listing
    mapping(string => address) public nodeOwners;      // nodeId => owner
    mapping(string => uint256) public revenueShareBps; // nodeId => upstream royalty bps

    event NodeListed(string nodeId, address owner, uint256 price);
    event NodeSold(string nodeId, address from, address to, uint256 price);
    event NodeDelisted(string nodeId);
    event RevenueShareSet(string nodeId, uint256 bps);

    // --- GOVERNANCE ---

    struct Proposal {
        address proposer;
        string description;
        uint256 forVotes;
        uint256 againstVotes;
        uint256 createdAt;
        uint256 endsAt;
        bool executed;
        mapping(address => bool) hasVoted;
    }

    uint256 public nextProposalId;
    mapping(uint256 => Proposal) public proposals;
    uint256 public constant VOTING_PERIOD = 3 days;
    uint256 public constant PROPOSAL_THRESHOLD = 100 * 1e18; // 100 $VERSE to propose

    event ProposalCreated(uint256 indexed proposalId, address proposer, string description);
    event Voted(uint256 indexed proposalId, address voter, bool support, uint256 weight);
    event ProposalExecuted(uint256 indexed proposalId, bool passed);

    constructor(address _verseToken) Ownable(msg.sender) {
        verseToken = IERC20(_verseToken);
    }

    // ==================== BOUNTIES ====================

    /// @notice Post a bounty on a narrative affordance
    /// @param parentNodeId The verse node to extend
    /// @param requiredType Required narrative type (e.g., "Character")
    /// @param description What should be created
    /// @param amount $VERSE to reward
    /// @param durationDays How long before the bounty expires
    function postBounty(
        string calldata parentNodeId,
        string calldata requiredType,
        string calldata description,
        uint256 amount,
        uint256 durationDays
    ) external {
        require(amount > 0, "Amount must be > 0");
        require(verseToken.transferFrom(msg.sender, address(this), amount), "Transfer failed");

        uint256 id = nextBountyId++;
        bounties[id] = Bounty({
            poster: msg.sender,
            parentNodeId: parentNodeId,
            requiredType: requiredType,
            description: description,
            amount: amount,
            claimed: false,
            claimedBy: address(0),
            fulfilledNodeId: "",
            createdAt: block.timestamp,
            expiresAt: block.timestamp + (durationDays * 1 days)
        });

        emit BountyPosted(id, msg.sender, parentNodeId, amount);
    }

    /// @notice Claim a bounty after creating the required verse
    /// @param bountyId The bounty to claim
    /// @param nodeId The newly created node ID that fulfills it
    function claimBounty(uint256 bountyId, string calldata nodeId) external {
        Bounty storage bounty = bounties[bountyId];
        require(!bounty.claimed, "Already claimed");
        require(block.timestamp <= bounty.expiresAt, "Bounty expired");

        bounty.claimed = true;
        bounty.claimedBy = msg.sender;
        bounty.fulfilledNodeId = nodeId;

        require(verseToken.transfer(msg.sender, bounty.amount), "Transfer failed");

        emit BountyClaimed(bountyId, msg.sender, nodeId);
    }

    /// @notice Reclaim expired bounty funds
    function reclaimBounty(uint256 bountyId) external {
        Bounty storage bounty = bounties[bountyId];
        require(msg.sender == bounty.poster, "Not poster");
        require(!bounty.claimed, "Already claimed");
        require(block.timestamp > bounty.expiresAt, "Not expired");

        bounty.claimed = true; // Prevent double-reclaim
        require(verseToken.transfer(bounty.poster, bounty.amount), "Transfer failed");

        emit BountyExpired(bountyId);
    }

    // ==================== IP TRADING ====================

    /// @notice Register as the owner of a verse node
    /// @dev First caller for a node becomes owner (trust-based for now)
    function registerNode(string calldata nodeId) external {
        require(nodeOwners[nodeId] == address(0), "Already owned");
        nodeOwners[nodeId] = msg.sender;
    }

    /// @notice List a verse node for sale
    function listNode(
        string calldata nodeId,
        uint256 price,
        uint256 royaltyBps
    ) external {
        require(nodeOwners[nodeId] == msg.sender, "Not owner");
        require(price > 0, "Price must be > 0");
        require(royaltyBps <= 2500, "Max 25% royalty");

        listings[nodeId] = Listing({
            owner: msg.sender,
            nodeId: nodeId,
            price: price,
            active: true,
            royaltyBps: royaltyBps
        });

        emit NodeListed(nodeId, msg.sender, price);
    }

    /// @notice Buy a listed verse node
    function buyNode(string calldata nodeId) external {
        Listing storage listing = listings[nodeId];
        require(listing.active, "Not listed");
        require(msg.sender != listing.owner, "Can't buy own");

        uint256 price = listing.price;
        address seller = listing.owner;

        // Transfer payment
        require(verseToken.transferFrom(msg.sender, seller, price), "Payment failed");

        // Transfer ownership
        nodeOwners[nodeId] = msg.sender;
        listing.active = false;

        // Set revenue share if specified
        if (listing.royaltyBps > 0) {
            revenueShareBps[nodeId] = listing.royaltyBps;
            emit RevenueShareSet(nodeId, listing.royaltyBps);
        }

        emit NodeSold(nodeId, seller, msg.sender, price);
    }

    /// @notice Delist a verse node
    function delistNode(string calldata nodeId) external {
        require(listings[nodeId].owner == msg.sender, "Not owner");
        listings[nodeId].active = false;
        emit NodeDelisted(nodeId);
    }

    /// @notice Set revenue share percentage for a node
    function setRevenueShare(string calldata nodeId, uint256 bps) external {
        require(nodeOwners[nodeId] == msg.sender, "Not owner");
        require(bps <= 5000, "Max 50%");
        revenueShareBps[nodeId] = bps;
        emit RevenueShareSet(nodeId, bps);
    }

    // ==================== GOVERNANCE ====================

    /// @notice Create a governance proposal
    function propose(string calldata description) external returns (uint256) {
        require(
            verseToken.balanceOf(msg.sender) >= PROPOSAL_THRESHOLD,
            "Need 100 $VERSE to propose"
        );

        uint256 id = nextProposalId++;
        Proposal storage p = proposals[id];
        p.proposer = msg.sender;
        p.description = description;
        p.createdAt = block.timestamp;
        p.endsAt = block.timestamp + VOTING_PERIOD;

        emit ProposalCreated(id, msg.sender, description);
        return id;
    }

    /// @notice Vote on a proposal (weight = $VERSE balance)
    function vote(uint256 proposalId, bool support) external {
        Proposal storage p = proposals[proposalId];
        require(block.timestamp <= p.endsAt, "Voting ended");
        require(!p.hasVoted[msg.sender], "Already voted");

        uint256 weight = verseToken.balanceOf(msg.sender);
        require(weight > 0, "No voting power");

        p.hasVoted[msg.sender] = true;

        if (support) {
            p.forVotes += weight;
        } else {
            p.againstVotes += weight;
        }

        emit Voted(proposalId, msg.sender, support, weight);
    }

    /// @notice Check if a proposal passed
    function proposalPassed(uint256 proposalId) external view returns (bool) {
        Proposal storage p = proposals[proposalId];
        require(block.timestamp > p.endsAt, "Voting not ended");
        return p.forVotes > p.againstVotes;
    }

    // ==================== VIEWS ====================

    /// @notice Get bounty details
    function getBounty(uint256 bountyId) external view returns (
        address poster, string memory parentNodeId, string memory requiredType,
        string memory description, uint256 amount, bool isClaimed,
        uint256 expiresAt
    ) {
        Bounty storage b = bounties[bountyId];
        return (b.poster, b.parentNodeId, b.requiredType, b.description, b.amount, b.claimed, b.expiresAt);
    }
}
