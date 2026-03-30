# Verse Protocol

**Proof of Creativity -- Decentralized Multiverse World-Building Protocol**

A system for collaborative world-building where creative influence is tracked, scored, and rewarded through a git-backed narrative DAG with semantic RDF metadata and on-chain attestation anchors.

> The verse most reused and expanded on gets rewarded.

**[Live Explorer](https://yellow-moss-0809fe90f.2.azurestaticapps.net)**

---

## Table of Contents

- [The Core Idea](#the-core-idea)
- [Architecture](#architecture)
- [Quick Start](#quick-start)
- [CLI Reference](#cli-reference)
- [Web Explorer](#web-explorer)
- [Participation Tiers](#participation-tiers)
- [Smart Contracts](#smart-contracts)
- [AI Agent Integration](#ai-agent-integration)
- [Security](#security)
- [The Ontology](#the-ontology)
- [How Canon Forms](#how-canon-forms)
- [Current World: Ashenmere](#current-world-ashenmere)
- [Federation](#federation)
- [License](#license)

---

## The Core Idea

Git is already a content-addressable Merkle DAG -- basically a blockchain without consensus. Verse Protocol layers **attribution-weighted provenance tracking** and an **incentive mechanism** on top of git's existing primitives, using RDF semantics for interoperability and on-chain attestations for verifiability.

Every narrative object (world, character, location, magic system, event) is a **typed compositional unit** -- a Context Graph context with explicit provenance and boundary. The git commit history provides the fork/merge DAG. The RDF layer provides semantic interoperability between verses authored by different people who never coordinated.

### Proof of Creativity

Instead of mining hashes, Verse Protocol measures **structural influence propagation** through the narrative DAG. Four components:

| Metric | Weight | What it measures |
|---|---|---|
| **Fork Depth** | 0.25 | How many generations of derivative works descend from a verse |
| **Structural Reuse** | 0.30 | How many downstream graphs reference entities first introduced in this verse |
| **Merge Centrality** | 0.25 | How often a verse's elements appear in merge commits that synthesize multiple branches |
| **Novelty Delta** | 0.20 | Information-theoretic divergence from parent contexts, weighted by downstream adoption |

```
I(v) = 0.25 * ForkDepth(v) + 0.30 * ReuseCount(v) + 0.25 * MergeCentrality(v) * 10 + 0.20 * NoveltyDelta(v)
```

High novelty + high adoption = genuine creative contribution, not just forking and adding a comma.

---

## Architecture

```
verse-protocol/
├── .github/
│   ├── workflows/
│   │   ├── verse-bot.yml                 # CI: tests, build, score on push
│   │   ├── identity-bot.yml              # Process identity claim issues
│   │   ├── world-builder-agent.yml       # Autonomous agent (daily at 3am UTC)
│   │   └── azure-static-web-apps-*.yml   # Deploy explorer to Azure
│   └── ISSUE_TEMPLATE/
│       ├── verse-extend.yml              # Propose a canonical extension
│       ├── verse-fork.yml                # Propose a divergent fork
│       ├── verse-merge.yml               # Propose a merge of threads
│       ├── claim-identity.yml            # Claim authorship identity
│       └── config.yml                    # Link to live explorer
│
├── .verse/                               # Verse data (git-tracked)
│   ├── manifest.json                     # Repo metadata, author identity, epoch counter
│   ├── nodes/*.json                      # Narrative objects (id, type, label, parents, relation, desc)
│   ├── content/*.md                      # Full lore/prose for each node
│   ├── rdf/*.ttl                         # RDF triples (Turtle format) per node
│   ├── authors/*.json                    # Author identity profiles
│   ├── snapshots/*.json                  # Epoch influence score snapshots with Merkle roots
│   └── federation/
│       ├── links.json                    # Cross-repo narrative links
│       └── remotes/                      # Cached remote verse data
│
├── packages/
│   ├── core/                             # Influence scoring engine
│   │   └── src/
│   │       ├── influence.js              # computeInfluence, buildMerkleRoot, PageRank-like scoring
│   │       ├── schema.js                 # Namespace, types, RDF generation
│   │       ├── index.js                  # Public API exports
│   │       └── influence.test.js         # Test suite
│   │
│   ├── cli/                              # Command-line interface
│   │   └── bin/
│   │       ├── verse.js                  # init, extend, fork, merge, score, status, attest
│   │       ├── federation.js             # discover, link, pull, status
│   │       └── world-builder.js          # Autonomous lore-consistent expansion agent
│   │
│   ├── web/                              # Interactive explorer (Vite + React)
│   │   └── src/
│   │       └── game/
│   │           ├── WorldView.jsx         # Spatial DAG visualization with rooms and corridors
│   │           ├── EpochReplay.jsx       # Animated timeline of world evolution
│   │           ├── EconomyView.jsx       # Token dashboard, bounty board, governance
│   │           ├── NodeRoom.jsx          # Detailed single-node view with lore
│   │           ├── ProposalBuilder.jsx   # Create extend/fork/merge proposals
│   │           ├── ActivityFeed.jsx      # Live activity stream
│   │           ├── worldGraph.js         # Graph algorithms and affordance detection
│   │           ├── usePresence.js        # Multiplayer presence hook
│   │           └── renderMarkdown.js     # Markdown rendering for lore content
│   │
│   ├── mcp/                              # Model Context Protocol server
│   │   ├── src/
│   │   │   └── server.js                 # MCP server exposing 8 tools + resources
│   │   ├── openai-functions.json         # OpenAI function calling schemas
│   │   └── package.json
│   │
│   └── contracts/                        # Solidity smart contracts
│       ├── contracts/
│       │   ├── VerseToken.sol            # ERC-20 with bonding curve + influence claims
│       │   ├── InfluenceAnchor.sol       # Epoch Merkle root on-chain anchoring
│       │   └── Marketplace.sol           # Bounties, IP trading, governance
│       └── deployments/
│           └── baseSepolia.json          # Deployed addresses on Base Sepolia
│
└── ontology/
    └── verse-ontology.ttl                # Full RDF vocabulary (9 sections, 511 lines)
```

### Packages

**`@verse-protocol/core`** -- The influence scoring engine. Computes a PageRank-like recursive metric over the narrative DAG, generates Merkle root snapshots for on-chain anchoring. Zero dependencies.

**`@verse-protocol/cli`** -- CLI for managing verse repos. Initializes `.verse/` directories with RDF metadata, creates properly attributed derivations (extends, forks, merges), computes scores, and generates EAS attestation data. Includes a federation client for cross-repo linking and an autonomous world-builder agent.

**`@verse-protocol/web`** -- Interactive multiverse explorer with five tabs: spatial DAG, influence scores, author rewards, narrative world view with rooms and affordances, and a token economy dashboard.

**`@verse-protocol/mcp`** -- Model Context Protocol server for AI agent integration. Exposes 8 tools and all verse nodes as readable resources. Includes OpenAI-compatible function schemas.

**`@verse-protocol/contracts`** -- Solidity smart contracts for the $VERSE token economy. Bonding curve pricing, Merkle-verified influence claims, bounty marketplace, IP trading with royalties, and on-chain governance.

---

## Quick Start

### Prerequisites

- Node.js 20+
- Git

### Install

```bash
git clone https://github.com/markjspivey-xwisee/verse-protocol.git
cd verse-protocol
npm install
```

### Launch the Explorer

```bash
npm run dev
```

Opens at `http://localhost:5173` with the full Ashenmere multiverse.

### Create a Verse Repo

```bash
# Initialize a new world
npm run verse -- init "Ashenmere" World

# Extend it with new narrative objects
npm run verse -- extend v1 "Pyro-Linguistics" System
npm run verse -- extend v1 "The Archivist" Character

# Fork a divergent branch
npm run verse -- fork v1 "Dark Ashenmere" World

# Merge multiple threads into something new
npm run verse -- merge "The Convergence" v2 v3

# View the DAG
npm run verse -- status

# Compute influence scores
npm run verse -- score

# Generate EAS attestation data
npm run verse -- attest
```

### Example Output

```
VERSE STATUS
Name:    Ashenmere
Author:  markj
Epoch:   5
Nodes:   5

DAG:
  v1  World      Ashenmere [origin]
  v2  System     Pyro-Linguistics [extends] <- v1
  v3  Character  The Archivist [extends] <- v1
  v4  World      Dark Ashenmere [forks] <- v1
  v5  Verse      The Convergence [merges] <- v2, v3
```

```
INFLUENCE SCORES -- 5 nodes

#   ID    Label                  Depth  Reuse  Merge%  Novel   TOTAL
----------------------------------------------------------------------
 1  v1     Ashenmere                  2     5     0%    0.00    2.000
 2  v2     Pyro-Linguistics           1     1    50%    0.00    1.800
 3  v3     The Archivist              1     1    50%    0.00    1.800
 4  v5     The Convergence            0     0     0%    1.12    0.224
 5  v4     Dark Ashenmere             0     0     0%    0.72    0.144

Merkle root: d445310426dfc67c...c7c4aadbb06e77a4
```

---

## CLI Reference

### verse.js -- World-Building Commands

All commands are run via `npm run verse -- <command>` or directly with `node packages/cli/bin/verse.js <command>`.

| Command | Description |
|---|---|
| `verse init <name> [type]` | Initialize a verse repo with `.verse/` directory. Default type is `World`. |
| `verse extend <parent> <name> [type]` | Create a canonical extension of a parent verse. Adds structure without contradicting the parent. |
| `verse fork <parent> <name> [type]` | Create a divergent fork. Modifies or contradicts parent canon. |
| `verse merge <name> <p1> <p2> [p3...]` | Synthesize multiple verses into one. Highest creativity signal. |
| `verse score` | Compute influence scores for all nodes + generate Merkle root snapshot. |
| `verse status` | Display the current verse DAG with all nodes and relations. |
| `verse attest` | Generate EAS attestation data for on-chain anchoring. |

### federation.js -- Cross-Repo Commands

All commands are run via `npm run federation -- <command>` or directly with `node packages/cli/bin/federation.js <command>`.

| Command | Description |
|---|---|
| `federation discover <github-user>` | Find other verse repos by a GitHub user. |
| `federation link <owner/repo> <local-id> <remote-id>` | Create a narrative link between a local node and a remote node. |
| `federation pull <owner/repo>` | Pull and cache remote verse data for cross-referencing. |
| `federation status` | Show all federation links and their status. |

### world-builder.js -- Autonomous Agent

```bash
node packages/cli/bin/world-builder.js --max 3
```

Automatically detects narrative affordances (gaps in the world) and generates lore-consistent nodes. Runs on a schedule via the `world-builder-agent.yml` GitHub Action (daily at 3am UTC) or manually.

### Narrative Object Types

`World` -- `Verse` -- `Character` -- `Location` -- `System` -- `Event` -- `Artifact` -- `Faction` -- `Timeline`

### Relation Types

| Relation | Meaning |
|---|---|
| `extends` | Adds new structure without contradicting the parent |
| `forks` | Diverges from the parent, modifying or contradicting canon |
| `merges` | Synthesizes multiple sources into a unified narrative |
| `redefines` | Same sign, new interpretant -- genuine creative reinterpretation |
| `translates` | Adapts to a different genre/setting while preserving structural isomorphism |
| `references` | Lightweight citation without structural dependency |

---

## Web Explorer

The live explorer at [yellow-moss-0809fe90f.2.azurestaticapps.net](https://yellow-moss-0809fe90f.2.azurestaticapps.net) provides five tabs:

| Tab | Component | Description |
|---|---|---|
| **DAG** | `MultiverseExplorer` | Spatial force-directed graph of all narrative objects. Nodes are color-coded by type, edges by relation. Click any node to inspect. |
| **Scores** | Influence Leaderboard | Ranked table of all nodes with fork depth, reuse count, merge centrality, novelty delta, and total score breakdown. |
| **Authors** | Author Rewards | Per-author contribution stats with $VERSE token projections based on cumulative influence. |
| **World** | `WorldView` | Navigable room-based world view. Each node is a "room" you can enter. Shows affordances (expansion opportunities) as glowing portals. Includes `NodeRoom` detail view, `ProposalBuilder` for creating new verses, `ActivityFeed` for live events, and `EpochReplay` for animated world history. |
| **Economy** | `EconomyView` | Token dashboard with bonding curve visualization, bounty board (reads from GitHub Issues), IP marketplace, and governance proposals. |

Additional game-layer components:

- **EpochReplay** -- Animated timeline replay showing how the world evolved epoch by epoch.
- **ProposalBuilder** -- In-browser form for proposing extends, forks, and merges (creates GitHub Issues).
- **ActivityFeed** -- Real-time event stream of world activity.
- **usePresence** -- Multiplayer presence awareness (see who else is exploring).

---

## Participation Tiers

Three ways to participate, from zero-install to full development:

| Tier | How | What you can do |
|---|---|---|
| **Browser** | Open a GitHub Issue using the provided templates | Propose extends, forks, and merges via structured forms. Claim an author identity. No install needed. |
| **CLI** | `npx verse-protocol` or clone the repo | Full command-line access to create nodes, compute scores, run federation commands, and generate attestations. |
| **Developer** | Clone + `npm install` | Modify the influence engine, build new explorer views, write smart contract extensions, create MCP tools, run the autonomous agent. |

### GitHub Issue Templates

| Template | Purpose |
|---|---|
| `verse-extend.yml` | Propose a canonical extension to an existing node |
| `verse-fork.yml` | Propose a divergent fork |
| `verse-merge.yml` | Propose merging multiple narrative threads |
| `claim-identity.yml` | Claim authorship identity (WebID, DID, Ethereum address) |

The `verse-bot.yml` workflow processes these issues automatically, creating the corresponding `.verse/` data and committing it to the repo.

---

## Smart Contracts

Three Solidity contracts are deployed on **Base Sepolia** (chain ID 84532):

| Contract | Address | Purpose |
|---|---|---|
| **VerseToken** | [`0xc3D979AFa9f932e717F91EA6560bF2Edc768aAde`](https://sepolia.basescan.org/address/0xc3D979AFa9f932e717F91EA6560bF2Edc768aAde) | ERC-20 $VERSE token with bonding curve pricing and influence claims |
| **InfluenceAnchor** | [`0x2A7879bD874326EA183E9596B11cD289e4558bdE`](https://sepolia.basescan.org/address/0x2A7879bD874326EA183E9596B11cD289e4558bdE) | Anchors epoch Merkle roots on-chain for verifiable score proofs |
| **Marketplace** | [`0xD86Ecaf363D62C81c681892F30465219ded6af3f`](https://sepolia.basescan.org/address/0xD86Ecaf363D62C81c681892F30465219ded6af3f) | Bounties, IP trading with royalties, and governance |

### VerseToken ($VERSE)

An ERC-20 with **bonding curve minting**. The price rises as supply grows, creating a natural incentive to participate early.

**Bonding curve formula:**

```
price(supply) = BASE_PRICE + SLOPE * supply^2
```

Where `BASE_PRICE = 0.0001 ETH` and `SLOPE = 0.00000001 ETH`.

Buy and sell operations use numerical integration over the curve for correct pricing. A 5% spread applies on sells.

**Influence claims:** Authors can claim $VERSE proportional to their influence score. The `claimInfluence` function verifies a Merkle proof against the on-chain snapshot, then mints `score * 100` tokens (capped at 100,000 $VERSE per epoch per node).

Key features:
- Integral-based pricing (not spot) for accurate buy/sell costs
- Slippage protection on both buy and sell
- Excess ETH refund on buy
- Marketplace-authorized minting for bounty rewards

### InfluenceAnchor

Stores Merkle roots of epoch influence score snapshots on-chain. Authorized submitters (owner + verse-bot) can publish snapshots. A **1-hour timelock** prevents claims against freshly submitted roots, allowing time to detect and invalidate fraudulent submissions.

Leaf format: `keccak256(abi.encodePacked(keccak256(abi.encode(claimer, nodeId, score))))` -- binds the claimer address to prevent unauthorized claims.

### Marketplace

Three subsystems in one contract:

**Bounties** -- Stake $VERSE to request specific content (e.g., "Create a Character in The Cinder Library"). Claims require poster approval before funds release. Bounties expire after 1-90 days with reclaim.

**IP Trading** -- Register node ownership with royalties (up to 25%). Original creators earn royalties on all secondary sales. Ownership transfers via `buyNode` with automatic royalty enforcement.

**Governance** -- Token-weighted voting on proposals. Requires 100 $VERSE to propose, 1000 $VERSE quorum to pass. 3-day voting period. 1-day cooldown between proposals per address. Snapshot-style vote weighting.

---

## AI Agent Integration

Verse Protocol is designed for human-AI co-creation. Four integration paths:

### Claude Code (CLAUDE.md)

Drop the included `CLAUDE.md` into any verse repo. Claude Code automatically reads it and understands the protocol -- verse commands, world rules, lore context, and how to create content that follows the world's systems. The file covers:

- All CLI commands with examples
- Project structure and `.verse/` directory layout
- Narrative object types and relation types
- Influence scoring formula
- Content creation guidelines (read lore first, respect systems, write rich content)
- Smart contract addresses
- Current world lore summary

### MCP Server

Add the verse MCP server to your Claude Code or Cline config:

```json
{
  "mcpServers": {
    "verse": {
      "command": "node",
      "args": ["packages/mcp/src/server.js"],
      "cwd": "/path/to/verse-repo"
    }
  }
}
```

This exposes 8 tools:

| Tool | Description |
|---|---|
| `verse_status` | View the current DAG |
| `verse_score` | Compute influence scores |
| `verse_extend` | Extend an existing node |
| `verse_fork` | Fork a node (divergent branch) |
| `verse_merge` | Merge multiple nodes |
| `verse_read_lore` | Read a node's full lore content |
| `verse_affordances` | Detect expansion opportunities |
| `verse_search` | Search nodes by label, type, author, or description |

All verse nodes are also exposed as MCP **resources** (URIs like `verse://v1`), making the full lore browsable by any MCP-compatible agent.

### OpenAI Function Schemas

Use the function schemas at `packages/mcp/openai-functions.json` with OpenAI's function calling API or any compatible agent framework:

```python
import json
with open("packages/mcp/openai-functions.json") as f:
    schemas = json.load(f)

response = client.chat.completions.create(
    model="gpt-4",
    messages=[{"role": "user", "content": "Extend the Cinder Library with a new character"}],
    functions=schemas["functions"],
)
```

The schema defines the same 8 functions as the MCP server with full parameter types, enums, and descriptions.

### Autonomous World-Builder Agent

The built-in agent runs on a schedule or manually:

```bash
# Run the agent to auto-detect affordances and create lore-consistent nodes
node packages/cli/bin/world-builder.js --max 3

# Or trigger via GitHub Actions (daily at 3am UTC)
gh workflow run world-builder-agent.yml
```

The agent:
1. Loads the current world state and reads existing lore
2. Detects affordances (unexplored regions, character vacancies, undefined systems, open plotlines)
3. Generates lore-consistent nodes with full prose content
4. Commits the new nodes and updates the epoch

---

## Security

A comprehensive security audit was performed covering all three smart contracts, the CLI, and the MCP server. **18 vulnerabilities** were identified and fixed across three severity levels:

| Severity | Count | Examples |
|---|---|---|
| **Critical** | 3 | Unbounded influence claims, unprotected Merkle root submission, reentrancy on token buy/sell |
| **High** | 7 | Missing slippage protection, unauthorized node registration, governance vote manipulation, missing royalty enforcement |
| **Medium** | 8 | CLI command injection via unsanitized inputs, MCP path traversal, missing input validation, RDF injection |

All fixes are implemented in the current codebase. Key mitigations include:
- `ReentrancyGuard` on all state-changing contract functions
- `SafeERC20` for all token transfers
- Merkle leaves bind claimer address to prevent unauthorized claims
- 1-hour timelock on influence snapshots
- Authorized submitter/registrar patterns
- Input sanitization in CLI and MCP server
- Quorum requirements and rate limiting on governance

---

## The Ontology

Full RDF vocabulary at `ontology/verse-ontology.ttl` -- namespace `https://ns.foxximediums.com/verse#`. Nine sections covering the complete semantic model:

| # | Section | Key Classes / Properties |
|---|---|---|
| 1 | **Narrative Object Classes** | `World`, `Verse`, `Character`, `Location`, `System`, `Event`, `Artifact`, `Faction`, `Timeline` -- all `rdfs:subClassOf cg:Context` |
| 2 | **Compositional Relations** | `reuses`, `extends`, `forks`, `merges`, `redefines`, `translates` -- subproperties of `prov:wasDerivedFrom` |
| 3 | **Provenance & Authorship** | Git commit anchoring (`commitHash`, `gitBranch`), identity (`DID`, `WebID`, `ethereumAddress`) |
| 4 | **Influence Scoring** | `InfluenceSnapshot`, `InfluenceScore`, `forkDepth`, `reuseCount`, `mergeCentrality`, `noveltyDelta`, `merkleRoot` |
| 5 | **On-Chain Attestation** | EAS attestation types: `authorship`, `influence_snapshot`, `license_grant`, `merge_ratification` |
| 6 | **Licensing & Rights** | CC-compatible structured rights with `revenueSharePercent` for DAG-propagated royalties |
| 7 | **Semiotic Grounding** | `Sign`, `Interpretant` classes (Peircean semiotics) so `verse:redefines` has formal semantics |
| 8 | **Agent Integration** | `AgentAuthor` with `directedBy` linking to human principals |
| 9 | **Discovery Affordances** | `NarrativeAffordance` types: `open_plotline`, `unexplored_region`, `crossover_opportunity` |

---

## How Canon Forms

When two people independently expand the same world in incompatible ways, neither "wins." Both branches persist in the DAG. The influence score determines which branch becomes the **de facto canonical path** -- not by authority, but by downstream adoption.

A verse that gets extended, forked, and merged into other works accumulates influence. A verse that sits alone does not. This is genuinely decentralized canon formation: the community decides what matters by building on top of it.

The scoring formula rewards:
- **Depth** -- being the root of a deep derivative tree
- **Reuse** -- having your entities referenced across many contexts
- **Centrality** -- appearing in merge nodes that synthesize multiple branches
- **Novelty** -- introducing genuinely new information that gets adopted downstream

---

## Current World: Ashenmere

The current verse repo contains **22 nodes** across 2 interconnected worlds at epoch 22.

### Ashenmere

A world where fire is memory and ash is language. Key systems:

- **Pyro-Linguistics** -- Burning materials produces semantic meaning. Flame color encodes grammar: blue flame asks questions, red flame declares, white flame commands.
- **Crystalline Memory** -- Deep-ocean crystals encode sensory memories, readable through song.
- Fire speaks truth and cannot produce fiction.
- The Cinder Library burns books to read them; ash patterns form the catalog.
- Wood burns in past tense, silk burns with longing, bone speaks identity.

### Node Map

| ID | Type | Label | Relation |
|---|---|---|---|
| v1 | World | Ashenmere | origin |
| v2 | System | Pyro-Linguistics | extends v1 |
| v3 | Character | The Archivist | extends v1 |
| v4 | Location | The Cinder Library | extends v1 |
| v5 | Artifact | Flame Grammar | extends v2 |
| v6 | Verse | The First Burning | merges v3, v4 |
| v7 | Verse | Resurrection Syntax | extends v6 |
| v8 | World | Glassdeep | forks v1 |
| v9 | System | Crystalline Memory | extends v8 |
| v10 | Faction | The Depth Singers | extends v8 |
| v11 | Verse | Ash on Glass | merges v4, v8 |
| v12 | Character | The Glassburner | extends v11 |
| v13 | Event | The Semiotic Fracture | forks v6 |
| v14 | Faction | Order of Cinders | extends v4 |
| v15 | Verse | The Deep Catalog | merges v9, v14 |
| v16 | Verse | Silent Flame | merges v3, v13 |
| v17 | Artifact | The Unburnable Word | extends v16 |
| v18 | Verse | Ashenmere Reforged | merges v7, v15 |
| v19 | Faction | The Ash Weavers | extends v1 |
| v20 | Location | The Ash Fields | extends v1 |
| v21 | Character | The Kindler | extends v20 |
| v22 | Location | The Ember Vaults | extends v4 |

All 22 nodes have full lore content in `.verse/content/`.

---

## Federation

Federation enables cross-repo multiverse linking. Different verse repos can reference each other's worlds, creating a decentralized network of interconnected narratives.

### How It Works

1. **Discover** -- Find other verse repos on GitHub:
   ```bash
   npm run federation -- discover markjspivey-xwisee
   ```

2. **Link** -- Connect a local node to a remote node:
   ```bash
   npm run federation -- link markjspivey-xwisee/verse-thornveil v1 v1
   ```

3. **Pull** -- Cache remote verse data locally:
   ```bash
   npm run federation -- pull markjspivey-xwisee/verse-thornveil
   ```

4. **Status** -- View all federation links:
   ```bash
   npm run federation -- status
   ```

### Current Federation Links

The Ashenmere world (v1) is linked to the **Thornveil** world from `markjspivey-xwisee/verse-thornveil` via a `references` relation. Federation data is stored in `.verse/federation/links.json` and cached remote nodes live in `.verse/federation/remotes/`.

Federation links enable:
- Cross-repo influence tracking (a verse in Thornveil that extends an Ashenmere concept propagates influence back)
- Multiverse navigation in the explorer (portals between worlds)
- Federated scoring across repo boundaries

---

## Development

```bash
# Run tests
npm test

# Build for production
npm run build

# Run the explorer locally
npm run dev
```

### CI/CD

Four GitHub Actions workflows:

| Workflow | Trigger | Purpose |
|---|---|---|
| `verse-bot.yml` | Push to master, issue events | Run tests, build, process verse proposals from issues |
| `identity-bot.yml` | Issue events | Process identity claim issues |
| `world-builder-agent.yml` | Daily at 3am UTC, manual | Run autonomous world-builder agent |
| `azure-static-web-apps-*.yml` | Push to master | Deploy explorer to Azure Static Web Apps |

---

## Design Lineage

Verse Protocol builds on:

- **Context Graphs** -- Typed compositional named graph contexts as the verse unit
- **HELA/SAT** -- Semiotic grounding so `verse:redefines` has formal semantics (same sign, shifted interpretant)
- **HyprCat** -- Affordance-based discovery layer for narrative expansion points
- **Solid Protocol** -- Decentralized data pods for federated verse storage
- **EAS** -- Ethereum Attestation Service for on-chain provenance anchoring

---

## License

CC BY 4.0 -- [Creative Commons Attribution 4.0 International](https://creativecommons.org/licenses/by/4.0/)

Built by [Mark Spivey / Foxxi Mediums Inc.](https://foxximediums.com)
