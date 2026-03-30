# Verse Protocol — Agent Instructions

You are operating inside a **Verse Protocol** repository — a decentralized multiverse world-building system where narrative objects (worlds, characters, locations, systems, events, artifacts, factions) form a DAG (directed acyclic graph) with influence scoring and on-chain attestation.

## Quick Reference

```bash
# View the current world
npm run verse -- status

# Create content
npm run verse -- init "World Name" World
npm run verse -- extend <parent-id> "Name" <Type>
npm run verse -- fork <parent-id> "Name" <Type>
npm run verse -- merge "Name" <parent1> <parent2>

# Score and analyze
npm run verse -- score

# Federation (cross-repo)
npm run federation -- discover <github-user>
npm run federation -- link <owner/repo> <local-id> <remote-id>
npm run federation -- pull <owner/repo>

# Autonomous expansion
node packages/cli/bin/world-builder.js --max 2
```

## Project Structure

```
.verse/                  # Verse data (git-tracked)
├── manifest.json        # Repo metadata, current epoch
├── nodes/*.json         # Narrative objects (id, type, label, parents, relation, desc)
├── content/*.md         # Full lore/prose for each node
├── rdf/*.ttl            # RDF triples (Turtle format)
├── authors/*.json       # Author identity profiles
├── snapshots/*.json     # Epoch influence score snapshots with Merkle roots
└── federation/          # Cross-repo links

packages/
├── core/src/            # Influence scoring engine (computeInfluence, buildMerkleRoot)
├── cli/bin/             # CLI commands (verse.js, federation.js, world-builder.js)
├── web/src/             # React explorer (DAG viz, world nav, economy, epoch replay)
└── contracts/           # Solidity smart contracts (VerseToken, InfluenceAnchor, Marketplace)

ontology/
└── verse-ontology.ttl   # Full RDF vocabulary (9 sections, 511 lines)
```

## Narrative Object Types

`World` · `Verse` · `Character` · `Location` · `System` · `Event` · `Artifact` · `Faction` · `Timeline`

## Relation Types

- `extends` — adds structure without contradicting parent
- `forks` — diverges from parent, modifies canon
- `merges` — synthesizes 2+ parents into something new
- `redefines` — same sign, new interpretant (creative reinterpretation)
- `translates` — adapts to different genre/setting
- `references` — lightweight citation

## Influence Scoring Formula

```
I(v) = 0.25·ForkDepth + 0.30·ReuseCount + 0.25·MergeCentrality·10 + 0.20·NoveltyΔ
```

## When Creating Verse Content

1. **Read existing lore first** — check `.verse/content/` for world rules and tone
2. **Respect the systems** — if a world has a System node (e.g., Pyro-Linguistics), new content must follow its rules
3. **Use proper types** — match the narrative object type to what you're creating
4. **Set the right relation** — extends for additions, forks for divergences, merges for synthesis
5. **Write rich content** — create a `.verse/content/{id}.md` with full prose, not just a description
6. **Run scoring** — `npm run verse -- score` after creating nodes to update influence metrics

## When Analyzing the World

- `npm run verse -- status` shows the full DAG
- `npm run verse -- score` computes and displays influence rankings
- Read `.verse/snapshots/epoch-*.json` for historical score data
- Read `.verse/content/` files to understand the lore

## Smart Contracts (Base Sepolia)

- VerseToken: `0xc3D979AFa9f932e717F91EA6560bF2Edc768aAde`
- InfluenceAnchor: `0x2A7879bD874326EA183E9596B11cD289e4558bdE`
- Marketplace: `0xD86Ecaf363D62C81c681892F30465219ded6af3f`

## The Current World: Ashenmere

A world where fire is memory and ash is language. Key systems:
- **Pyro-Linguistics**: burning materials produces semantic meaning; flame color = grammar
- **Crystalline Memory**: deep-ocean crystal encodes sensory memories; read through song
- Fire speaks truth and cannot produce fiction
- The Cinder Library burns books to read them; ash patterns are the catalog

When creating content in Ashenmere, wood burns in past tense, silk burns with longing, blue flame asks questions, and bone speaks identity.
