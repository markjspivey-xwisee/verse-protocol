# ◆ Verse Protocol

**Proof of Creativity — Decentralized Multiverse World-Building Protocol**

A system for collaborative world-building where creative influence is tracked, scored, and rewarded through a git-backed narrative DAG with semantic RDF metadata and on-chain attestation anchors.

> The verse most reused and expanded on gets rewarded.

**[Live Explorer →](https://yellow-moss-0809fe90f.2.azurestaticapps.net)**

---

## The Core Idea

Git is already a content-addressable Merkle DAG — basically a blockchain without consensus. Verse Protocol layers **attribution-weighted provenance tracking** and an **incentive mechanism** on top of git's existing primitives, using RDF semantics for interoperability and on-chain attestations for verifiability.

Every narrative object (world, character, location, magic system, event) is a **typed compositional unit** — a Context Graph context with explicit provenance and boundary. The git commit history provides the fork/merge DAG. The RDF layer provides semantic interoperability between verses authored by different people who never coordinated.

### Proof of Creativity

Instead of mining hashes, Verse Protocol measures **structural influence propagation** through the narrative DAG. Four components:

| Metric | Weight | What it measures |
|---|---|---|
| **Fork Depth** | 0.25 | How many generations of derivative works descend from a verse |
| **Structural Reuse** | 0.30 | How many downstream graphs reference entities first introduced in this verse |
| **Merge Centrality** | 0.25 | How often a verse's elements appear in merge commits that synthesize multiple branches |
| **Novelty Delta** | 0.20 | Information-theoretic divergence from parent contexts, weighted by downstream adoption |

```
I(v) = 0.25·ForkDepth(v) + 0.30·ReuseCount(v) + 0.25·MergeCentrality(v)·10 + 0.20·NoveltyΔ(v)
```

High novelty + high adoption = genuine creative contribution, not just forking and adding a comma.

---

## Architecture

```
verse-protocol/
├── packages/
│   ├── core/           # Influence scoring engine + schema constants
│   │   └── src/
│   │       ├── influence.js    # PageRank-like scoring, Merkle root generation
│   │       ├── schema.js       # Namespace, types, RDF generation
│   │       └── influence.test.js
│   ├── cli/            # Command-line interface
│   │   └── bin/
│   │       └── verse.js        # init, extend, fork, merge, score, status, attest
│   └── web/            # Interactive DAG explorer (Vite + React)
│       └── src/
│           ├── MultiverseExplorer.jsx
│           └── data/seed.js    # Sample multiverse (Ashenmere × Glassdeep)
└── ontology/
    └── verse-ontology.ttl      # Full RDF vocabulary (511 lines, 9 sections)
```

### Packages

**`@verse-protocol/core`** — The influence scoring engine. Computes a PageRank-like recursive metric over the narrative DAG, generates Merkle root snapshots for on-chain anchoring. Zero dependencies.

**`@verse-protocol/cli`** — CLI for managing verse repos. Initializes `.verse/` directories with RDF metadata, creates properly attributed derivations (extends, forks, merges), computes scores, and generates EAS attestation data.

**`@verse-protocol/web`** — Interactive multiverse DAG explorer with three views: spatial graph with relation-typed edges, influence leaderboard with formula breakdown, and author reward distribution with $VERSE token projections.

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

Opens at `http://localhost:5173` — explore the sample Ashenmere × Glassdeep multiverse.

### Create a Verse Repo

```bash
# Initialize a new world
npm run verse -- init "Ashenmere" World

# Extend it
npm run verse -- extend v1 "Pyro-Linguistics" System
npm run verse -- extend v1 "The Archivist" Character

# Fork a divergent branch
npm run verse -- fork v1 "Dark Ashenmere" World

# Merge multiple threads
npm run verse -- merge "The Convergence" v2 v3

# View the DAG
npm run verse -- status

# Compute influence scores
npm run verse -- score

# Generate attestation data
npm run verse -- attest
```

### Example Output

```
◆ VERSE STATUS
Name:    Ashenmere
Author:  markj
Epoch:   4
Nodes:   5

DAG:
  v1  World      Ashenmere [origin]
  v2  System     Pyro-Linguistics [extends] ← v1
  v3  Character  The Archivist [extends] ← v1
  v4  World      Dark Ashenmere [forks] ← v1
  v5  Verse      The Convergence [merges] ← v2, v3
```

```
◆ INFLUENCE SCORES — 5 nodes

#   ID    Label                  Depth  Reuse  Merge%  Novel   TOTAL
──────────────────────────────────────────────────────────────────────
 1  v1     Ashenmere                  2     5     0%    0.00    2.000
 2  v2     Pyro-Linguistics           1     1    50%    0.00    1.800
 3  v3     The Archivist              1     1    50%    0.00    1.800
 4  v5     The Convergence            0     0     0%    1.12    0.224
 5  v4     Dark Ashenmere             0     0     0%    0.72    0.144

Merkle root: d445310426dfc67c...c7c4aadbb06e77a4
```

---

## CLI Reference

| Command | Description |
|---|---|
| `verse init <name> [type]` | Initialize a verse repo with `.verse/` directory |
| `verse extend <parent> <name> [type]` | Create a canonical extension of a parent verse |
| `verse fork <parent> <name> [type]` | Create a divergent fork (branch in the narrative DAG) |
| `verse merge <name> <p1> <p2> [p3...]` | Synthesize multiple verses into one |
| `verse score` | Compute influence scores + Merkle root snapshot |
| `verse status` | Display the current verse DAG |
| `verse attest` | Generate EAS attestation data for on-chain anchoring |

### Narrative Object Types

`World` · `Verse` · `Character` · `Location` · `System` · `Event` · `Artifact` · `Faction` · `Timeline`

### Relation Types

| Relation | Meaning |
|---|---|
| `extends` | Adds new structure without contradicting the parent |
| `forks` | Diverges from the parent, modifying or contradicting canon |
| `merges` | Synthesizes multiple sources into a unified narrative |
| `redefines` | Same sign, new interpretant — genuine creative reinterpretation |
| `translates` | Adapts to a different genre/setting while preserving structural isomorphism |
| `references` | Lightweight citation without structural dependency |

---

## The Ontology

Full RDF vocabulary at `ontology/verse-ontology.ttl` — namespace `https://ns.foxximediums.com/verse#`.

Nine sections:

1. **Narrative Object Classes** — World, Verse, Character, Location, System, Event, Artifact, Faction, Timeline (all `rdfs:subClassOf cg:Context`)
2. **Compositional Relations** — reuses, extends, forks, merges, redefines, translates (subproperties of `prov:wasDerivedFrom`)
3. **Provenance & Authorship** — Git commit anchoring, DID/WebID/ETH identity
4. **Influence Scoring** — InfluenceSnapshot, InfluenceScore with all four metric components + Merkle root
5. **On-Chain Attestation** — EAS attestation types (authorship, influence_snapshot, license_grant, merge_ratification)
6. **Licensing & Rights** — CC-compatible structured rights with `revenueSharePercent` for DAG-propagated royalties
7. **Semiotic Grounding** — Sign/Interpretant classes (from Peircean semiotics) so `verse:redefines` has formal semantics
8. **Agent Integration** — AgentAuthor with `directedBy` linking to human principals
9. **Discovery Affordances** — NarrativeAffordance types (open_plotline, unexplored_region, crossover_opportunity)

---

## The `.verse/` Directory

When you run `verse init`, a `.verse/` directory is created with:

```
.verse/
├── manifest.json           # Repo metadata, author identity, current epoch
├── nodes/
│   ├── v1.json             # Node data (type, label, parents, relation, etc.)
│   ├── v2.json
│   └── ...
├── rdf/
│   ├── v1.ttl              # Auto-generated RDF context for each node
│   ├── v2.ttl
│   └── ...
├── snapshots/
│   └── epoch-4.json        # Influence score snapshots with Merkle roots
└── verse-ontology.ttl      # Local copy of the ontology
```

---

## On-Chain Layer (Planned)

The chain stays thin — it doesn't store content (that's git). It stores:

- **Attestations** — Signed commitments via [EAS](https://docs.attest.sh) that "verse X at commit hash Y is authored by DID Z"
- **Influence Snapshots** — Periodic Merkle roots of influence score computations
- **Reward Distribution** — ERC-20 `$VERSE` token with epoch-based minting proportional to influence delta

Identity bridging: [ERC-4361 (SIWE)](https://eips.ethereum.org/EIPS/eip-4361) for linking Solid WebIDs to Ethereum addresses.

The `verse attest` command generates attestation data locally. Submitting on-chain requires setting an `ethereumAddress` in `.verse/manifest.json` and using the EAS SDK.

---

## How Canon Forms

When two people independently expand the same world in incompatible ways, neither "wins." Both branches persist. The influence score determines which branch becomes the **de facto canonical path** — not by authority, but by downstream adoption.

This is genuinely decentralized canon formation.

---

## Development

```bash
# Run tests (15 tests across 3 suites)
npm test

# Build for production
npm run build

# Run the explorer locally
npm run dev
```

### CI/CD

GitHub Actions pipeline on every push to `master`:
- Tests on Node.js 20 and 22
- Production build
- Auto-deploy to Azure Static Web Apps

---

## Design Lineage

Verse Protocol builds on:

- **Context Graphs** — Typed compositional named graph contexts as the verse unit
- **HELA/SAT** — Semiotic grounding so `verse:redefines` has formal semantics (same sign, shifted interpretant)
- **HyprCat** — Affordance-based discovery layer for narrative expansion points
- **Solid Protocol** — Decentralized data pods for federated verse storage
- **EAS** — Ethereum Attestation Service for on-chain provenance anchoring

---

## License

CC BY 4.0 — [Creative Commons Attribution 4.0 International](https://creativecommons.org/licenses/by/4.0/)

Built by [Mark Spivey / Foxxi Mediums Inc.](https://foxximediums.com)
