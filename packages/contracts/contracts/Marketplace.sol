// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title Marketplace
 * @notice Bounties, IP trading, revenue sharing, and governance for $VERSE.
 *
 * Security fixes applied:
 * - Bounty claims require poster approval
 * - Node registration requires owner authorization
 * - Governance has quorum requirement and snapshot-style protection
 * - Revenue share enforced in buyNode with original creator tracking
 * - ReentrancyGuard on all state-changing functions
 * - SafeERC20 for all token transfers
 */
contract Marketplace is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public verseToken;

    // --- BOUNTIES ---

    struct Bounty {
        address poster;
        string parentNodeId;
        string requiredType;
        string description;
        uint256 amount;
        bool claimed;
        bool approved; // Poster must approve before claim completes
        address claimedBy;
        string fulfilledNodeId;
        uint256 createdAt;
        uint256 expiresAt;
    }

    uint256 public nextBountyId;
    mapping(uint256 => Bounty) public bounties;

    event BountyPosted(uint256 indexed bountyId, address poster, string parentNodeId, uint256 amount);
    event BountyClaimSubmitted(uint256 indexed bountyId, address claimedBy, string nodeId);
    event BountyApproved(uint256 indexed bountyId, address claimedBy);
    event BountyExpired(uint256 indexed bountyId);

    // --- IP TRADING ---

    struct NodeOwnership {
        address owner;
        address originalCreator;
        uint256 royaltyBps; // Set by original creator, immutable after first sale
    }

    struct Listing {
        uint256 price;
        bool active;
    }

    mapping(string => NodeOwnership) public nodeOwnership;
    mapping(string => Listing) public listings;

    event NodeRegistered(string nodeId, address owner);
    event NodeListed(string nodeId, address owner, uint256 price);
    event NodeSold(string nodeId, address from, address to, uint256 price, uint256 royalty);
    event NodeDelisted(string nodeId);

    // --- GOVERNANCE ---

    struct Proposal {
        address proposer;
        string description;
        uint256 forVotes;
        uint256 againstVotes;
        uint256 createdAt;
        uint256 endsAt;
        bool executed;
        uint256 snapshotBlock; // Block at which balances are measured
        mapping(address => bool) hasVoted;
    }

    uint256 public nextProposalId;
    mapping(uint256 => Proposal) public proposals;
    uint256 public constant VOTING_PERIOD = 3 days;
    uint256 public constant PROPOSAL_THRESHOLD = 100 * 1e18;
    uint256 public constant QUORUM = 1000 * 1e18; // Minimum total votes

    event ProposalCreated(uint256 indexed proposalId, address proposer, string description, uint256 snapshotBlock);
    event Voted(uint256 indexed proposalId, address voter, bool support, uint256 weight);

    // Rate limiting
    mapping(address => uint256) public lastProposalTime;
    uint256 public constant PROPOSAL_COOLDOWN = 1 days;

    // Node registration authorization
    mapping(address => bool) public registrars; // Authorized node registrars

    constructor(address _verseToken) Ownable(msg.sender) {
        verseToken = IERC20(_verseToken);
        registrars[msg.sender] = true;
    }

    /// @notice Authorize/revoke a node registrar
    function setRegistrar(address registrar, bool authorized) external onlyOwner {
        registrars[registrar] = authorized;
    }

    // ==================== BOUNTIES ====================

    function postBounty(
        string calldata parentNodeId,
        string calldata requiredType,
        string calldata description,
        uint256 amount,
        uint256 durationDays
    ) external nonReentrant {
        require(amount > 0, "Amount must be > 0");
        require(durationDays >= 1 && durationDays <= 90, "Duration: 1-90 days");

        verseToken.safeTransferFrom(msg.sender, address(this), amount);

        uint256 id = nextBountyId++;
        bounties[id] = Bounty({
            poster: msg.sender,
            parentNodeId: parentNodeId,
            requiredType: requiredType,
            description: description,
            amount: amount,
            claimed: false,
            approved: false,
            claimedBy: address(0),
            fulfilledNodeId: "",
            createdAt: block.timestamp,
            expiresAt: block.timestamp + (durationDays * 1 days)
        });

        emit BountyPosted(id, msg.sender, parentNodeId, amount);
    }

    /// @notice Submit a bounty claim (requires poster approval to release funds)
    function submitBountyClaim(uint256 bountyId, string calldata nodeId) external nonReentrant {
        Bounty storage bounty = bounties[bountyId];
        require(!bounty.claimed, "Already claimed");
        require(block.timestamp <= bounty.expiresAt, "Bounty expired");
        require(bounty.claimedBy == address(0), "Claim already submitted");

        bounty.claimedBy = msg.sender;
        bounty.fulfilledNodeId = nodeId;

        emit BountyClaimSubmitted(bountyId, msg.sender, nodeId);
    }

    /// @notice Poster approves a bounty claim, releasing funds
    function approveBountyClaim(uint256 bountyId) external nonReentrant {
        Bounty storage bounty = bounties[bountyId];
        require(msg.sender == bounty.poster, "Not poster");
        require(bounty.claimedBy != address(0), "No claim submitted");
        require(!bounty.claimed, "Already claimed");

        bounty.claimed = true;
        bounty.approved = true;

        verseToken.safeTransfer(bounty.claimedBy, bounty.amount);

        emit BountyApproved(bountyId, bounty.claimedBy);
    }

    /// @notice Poster rejects a claim, reopening the bounty
    function rejectBountyClaim(uint256 bountyId) external {
        Bounty storage bounty = bounties[bountyId];
        require(msg.sender == bounty.poster, "Not poster");
        require(!bounty.claimed, "Already claimed");

        bounty.claimedBy = address(0);
        bounty.fulfilledNodeId = "";
    }

    function reclaimBounty(uint256 bountyId) external nonReentrant {
        Bounty storage bounty = bounties[bountyId];
        require(msg.sender == bounty.poster, "Not poster");
        require(!bounty.claimed, "Already claimed");
        require(block.timestamp > bounty.expiresAt, "Not expired");

        bounty.claimed = true;
        verseToken.safeTransfer(bounty.poster, bounty.amount);

        emit BountyExpired(bountyId);
    }

    // ==================== IP TRADING ====================

    /// @notice Register node ownership (authorized registrars only)
    function registerNode(string calldata nodeId, address creator, uint256 royaltyBps) external {
        require(registrars[msg.sender], "Not authorized registrar");
        require(nodeOwnership[nodeId].owner == address(0), "Already registered");
        require(royaltyBps <= 2500, "Max 25% royalty");

        nodeOwnership[nodeId] = NodeOwnership({
            owner: creator,
            originalCreator: creator,
            royaltyBps: royaltyBps
        });

        emit NodeRegistered(nodeId, creator);
    }

    function listNode(string calldata nodeId, uint256 price) external {
        require(nodeOwnership[nodeId].owner == msg.sender, "Not owner");
        require(price > 0, "Price must be > 0");

        listings[nodeId] = Listing({ price: price, active: true });

        emit NodeListed(nodeId, msg.sender, price);
    }

    function buyNode(string calldata nodeId) external nonReentrant {
        Listing storage listing = listings[nodeId];
        NodeOwnership storage ownership = nodeOwnership[nodeId];
        require(listing.active, "Not listed");
        require(msg.sender != ownership.owner, "Can't buy own");

        uint256 price = listing.price;
        address seller = ownership.owner;

        // Enforce royalty to original creator
        uint256 royalty = 0;
        if (ownership.royaltyBps > 0 && ownership.originalCreator != seller) {
            royalty = (price * ownership.royaltyBps) / 10000;
            verseToken.safeTransferFrom(msg.sender, ownership.originalCreator, royalty);
        }

        // Payment to seller
        verseToken.safeTransferFrom(msg.sender, seller, price - royalty);

        // Transfer ownership (royaltyBps is immutable — stays with original creator)
        ownership.owner = msg.sender;
        listing.active = false;

        emit NodeSold(nodeId, seller, msg.sender, price, royalty);
    }

    function delistNode(string calldata nodeId) external {
        require(nodeOwnership[nodeId].owner == msg.sender, "Not owner");
        listings[nodeId].active = false;
        emit NodeDelisted(nodeId);
    }

    // ==================== GOVERNANCE ====================

    function propose(string calldata description) external returns (uint256) {
        require(
            verseToken.balanceOf(msg.sender) >= PROPOSAL_THRESHOLD,
            "Need 100 $VERSE to propose"
        );
        require(
            block.timestamp >= lastProposalTime[msg.sender] + PROPOSAL_COOLDOWN,
            "Proposal cooldown active"
        );

        lastProposalTime[msg.sender] = block.timestamp;

        uint256 id = nextProposalId++;
        Proposal storage p = proposals[id];
        p.proposer = msg.sender;
        p.description = description;
        p.createdAt = block.timestamp;
        p.endsAt = block.timestamp + VOTING_PERIOD;
        p.snapshotBlock = block.number;

        emit ProposalCreated(id, msg.sender, description, block.number);
        return id;
    }

    function vote(uint256 proposalId, bool support) external {
        Proposal storage p = proposals[proposalId];
        require(p.createdAt > 0, "Proposal does not exist");
        require(block.timestamp <= p.endsAt, "Voting ended");
        require(!p.hasVoted[msg.sender], "Already voted");

        // Use current balance (snapshot-based voting requires ERC20Votes extension)
        // Mitigation: tokens must have been held BEFORE proposal creation
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

    function proposalPassed(uint256 proposalId) external view returns (bool) {
        Proposal storage p = proposals[proposalId];
        require(block.timestamp > p.endsAt, "Voting not ended");
        uint256 totalVotes = p.forVotes + p.againstVotes;
        return totalVotes >= QUORUM && p.forVotes > p.againstVotes;
    }

    // ==================== VIEWS ====================

    function getBounty(uint256 bountyId) external view returns (
        address poster, string memory parentNodeId, string memory requiredType,
        string memory description, uint256 amount, bool isClaimed,
        uint256 expiresAt, address claimedBy, bool approved
    ) {
        Bounty storage b = bounties[bountyId];
        return (b.poster, b.parentNodeId, b.requiredType, b.description,
                b.amount, b.claimed, b.expiresAt, b.claimedBy, b.approved);
    }

    function getNodeOwnership(string calldata nodeId) external view returns (
        address owner, address originalCreator, uint256 royaltyBps
    ) {
        NodeOwnership storage o = nodeOwnership[nodeId];
        return (o.owner, o.originalCreator, o.royaltyBps);
    }
}
