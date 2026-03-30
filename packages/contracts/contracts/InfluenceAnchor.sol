// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

/**
 * @title InfluenceAnchor
 * @notice Anchors epoch influence score Merkle roots on-chain.
 *
 * The verse CLI computes influence scores locally and generates
 * SHA-256 Merkle roots. This contract stores those roots and
 * enables Merkle proof verification for token claims.
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

    event SnapshotSubmitted(uint256 indexed epoch, bytes32 merkleRoot, uint256 nodeCount);
    event SubmitterUpdated(address indexed submitter, bool authorized);

    constructor() Ownable(msg.sender) {
        submitters[msg.sender] = true;
    }

    modifier onlySubmitter() {
        require(submitters[msg.sender], "Not authorized submitter");
        _;
    }

    /// @notice Authorize or revoke a submitter address
    function setSubmitter(address submitter, bool authorized) external onlyOwner {
        submitters[submitter] = authorized;
        emit SubmitterUpdated(submitter, authorized);
    }

    /// @notice Submit an epoch Merkle root
    /// @param epoch The epoch number (must be > latestEpoch)
    /// @param merkleRoot The Merkle root of all influence scores
    /// @param nodeCount Number of nodes in this epoch
    function submitSnapshot(
        uint256 epoch,
        bytes32 merkleRoot,
        uint256 nodeCount
    ) external onlySubmitter {
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

    /// @notice Verify a score claim against a stored Merkle root
    /// @param epoch The epoch to verify against
    /// @param nodeId The verse node ID
    /// @param score The claimed influence score
    /// @param proof The Merkle proof
    /// @return valid Whether the proof is valid
    function verifyScore(
        uint256 epoch,
        string calldata nodeId,
        uint256 score,
        bytes32[] calldata proof
    ) external view returns (bool valid) {
        Snapshot storage snapshot = snapshots[epoch];
        require(snapshot.exists, "Epoch not found");

        // Leaf format matches the off-chain computation:
        // keccak256(abi.encodePacked(nodeId, ":", score))
        bytes32 leaf = keccak256(
            abi.encodePacked(
                keccak256(abi.encodePacked(nodeId, ":", score))
            )
        );

        return MerkleProof.verify(proof, snapshot.merkleRoot, leaf);
    }

    /// @notice Get snapshot data for an epoch
    function getSnapshot(uint256 epoch) external view returns (
        bytes32 merkleRoot,
        uint256 timestamp,
        uint256 nodeCount
    ) {
        Snapshot storage snapshot = snapshots[epoch];
        require(snapshot.exists, "Epoch not found");
        return (snapshot.merkleRoot, snapshot.timestamp, snapshot.nodeCount);
    }
}
