// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

/**
 * @title InfluenceAnchor
 * @notice Anchors epoch influence score Merkle roots on-chain.
 *
 * Merkle leaves bind (claimer address, nodeId, score) to prevent
 * unauthorized claims. Uses abi.encode (not encodePacked) to prevent
 * hash collisions.
 */
contract InfluenceAnchor is Ownable {
    struct Snapshot {
        bytes32 merkleRoot;
        uint256 timestamp;
        uint256 nodeCount;
        bool exists;
    }

    mapping(uint256 => Snapshot) public snapshots; // epoch => snapshot
    uint256 public latestEpoch;

    // Authorized submitters (owner + verse-bot address)
    mapping(address => bool) public submitters;

    // Timelock: snapshots become active after this delay
    uint256 public constant SNAPSHOT_DELAY = 1 hours;

    event SnapshotSubmitted(uint256 indexed epoch, bytes32 merkleRoot, uint256 nodeCount);
    event SnapshotInvalidated(uint256 indexed epoch);
    event SubmitterUpdated(address indexed submitter, bool authorized);

    constructor() Ownable(msg.sender) {
        submitters[msg.sender] = true;
    }

    modifier onlySubmitter() {
        require(submitters[msg.sender], "Not authorized submitter");
        _;
    }

    function setSubmitter(address submitter, bool authorized) external onlyOwner {
        submitters[submitter] = authorized;
        emit SubmitterUpdated(submitter, authorized);
    }

    /// @notice Submit an epoch Merkle root
    function submitSnapshot(
        uint256 epoch,
        bytes32 merkleRoot,
        uint256 nodeCount
    ) external onlySubmitter {
        require(!snapshots[epoch].exists, "Epoch already submitted");
        require(epoch > latestEpoch || latestEpoch == 0, "Epoch must be newer");
        require(merkleRoot != bytes32(0), "Empty root");

        snapshots[epoch] = Snapshot({
            merkleRoot: merkleRoot,
            timestamp: block.timestamp,
            nodeCount: nodeCount,
            exists: true
        });

        latestEpoch = epoch;
        emit SnapshotSubmitted(epoch, merkleRoot, nodeCount);
    }

    /// @notice Invalidate a snapshot (emergency, owner only)
    function invalidateSnapshot(uint256 epoch) external onlyOwner {
        require(snapshots[epoch].exists, "Epoch not found");
        delete snapshots[epoch];
        emit SnapshotInvalidated(epoch);
    }

    /// @notice Check if a snapshot is active (past timelock)
    function isSnapshotActive(uint256 epoch) public view returns (bool) {
        Snapshot storage s = snapshots[epoch];
        return s.exists && block.timestamp >= s.timestamp + SNAPSHOT_DELAY;
    }

    /// @notice Verify a score claim against a stored Merkle root
    /// @dev Leaf = keccak256(abi.encode(claimer, nodeId, score)) — binds address
    function verifyScore(
        uint256 epoch,
        string calldata nodeId,
        address claimer,
        uint256 score,
        bytes32[] calldata proof
    ) external view returns (bool valid) {
        Snapshot storage snapshot = snapshots[epoch];
        require(snapshot.exists, "Epoch not found");
        require(block.timestamp >= snapshot.timestamp + SNAPSHOT_DELAY, "Snapshot not active yet");

        // Leaf includes claimer address to prevent unauthorized claims
        bytes32 leaf = keccak256(
            abi.encodePacked(
                keccak256(abi.encode(claimer, nodeId, score))
            )
        );

        return MerkleProof.verify(proof, snapshot.merkleRoot, leaf);
    }

    function getSnapshot(uint256 epoch) external view returns (
        bytes32 merkleRoot, uint256 timestamp, uint256 nodeCount, bool active
    ) {
        Snapshot storage s = snapshots[epoch];
        require(s.exists, "Epoch not found");
        return (s.merkleRoot, s.timestamp, s.nodeCount, isSnapshotActive(epoch));
    }
}
