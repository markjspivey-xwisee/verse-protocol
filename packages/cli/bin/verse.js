#!/usr/bin/env node

/**
 * verse — CLI for the Verse Protocol
 *
 * Commands:
 *   verse init <name>              Initialize a new verse repo
 *   verse extend <parent> <name>   Create a properly attributed extension
 *   verse fork <parent> <name>     Create a divergent fork
 *   verse merge <name> <p1> <p2>   Merge multiple verses
 *   verse score                    Compute influence scores for the current repo
 *   verse status                   Show verse DAG status
 *   verse attest                   Generate EAS attestation data
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'fs';
import { join, resolve } from 'path';
import { execSync } from 'child_process';
// Try workspace import first, fall back to bundled lib for npx/standalone use
let core;
try {
  core = await import('@verse-protocol/core');
} catch {
  const influence = await import('../lib/influence.js');
  const schema = await import('../lib/schema.js');
  core = { ...influence, ...schema };
}
const { computeInfluence, buildMerkleRoot, NARRATIVE_TYPES, RELATION_TYPES, generateContextRDF } = core;

const args = process.argv.slice(2);
const cmd = args[0];
const cwd = process.cwd();

const VERSE_DIR = '.verse';
const MANIFEST = 'manifest.json';
const NODES_DIR = 'nodes';

// ─── Helpers ───

function verseRoot() {
  let dir = cwd;
  while (dir !== resolve(dir, '..')) {
    if (existsSync(join(dir, VERSE_DIR))) return dir;
    dir = resolve(dir, '..');
  }
  return null;
}

function readManifest(root) {
  const p = join(root, VERSE_DIR, MANIFEST);
  return existsSync(p) ? JSON.parse(readFileSync(p, 'utf-8')) : null;
}

function writeManifest(root, data) {
  writeFileSync(join(root, VERSE_DIR, MANIFEST), JSON.stringify(data, null, 2));
}

function loadNodes(root) {
  const dir = join(root, VERSE_DIR, NODES_DIR);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter(f => f.endsWith('.json'))
    .map(f => JSON.parse(readFileSync(join(dir, f), 'utf-8')));
}

function saveNode(root, node) {
  const dir = join(root, VERSE_DIR, NODES_DIR);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${node.id}.json`), JSON.stringify(node, null, 2));
  // Also write the RDF context
  const rdfDir = join(root, VERSE_DIR, 'rdf');
  mkdirSync(rdfDir, { recursive: true });
  writeFileSync(join(rdfDir, `${node.id}.ttl`), generateContextRDF(node));
}

function gitHash() {
  try {
    return execSync('git rev-parse HEAD', { cwd, encoding: 'utf-8' }).trim();
  } catch {
    return null;
  }
}

function gitBranch() {
  try {
    return execSync('git rev-parse --abbrev-ref HEAD', { cwd, encoding: 'utf-8' }).trim();
  } catch {
    return null;
  }
}

function nextId(nodes) {
  const max = nodes.reduce((m, n) => {
    const num = parseInt(n.id.replace('v', ''), 10);
    return num > m ? num : m;
  }, 0);
  return `v${max + 1}`;
}

function timestamp() {
  return new Date().toISOString();
}

// ─── Commands ───

const commands = {
  init() {
    const name = args[1];
    const type = args[2] || 'World';
    if (!name) {
      console.error('Usage: verse init <name> [type]');
      console.error(`Types: ${NARRATIVE_TYPES.join(', ')}`);
      process.exit(1);
    }

    if (!NARRATIVE_TYPES.includes(type)) {
      console.error(`Unknown type "${type}". Valid: ${NARRATIVE_TYPES.join(', ')}`);
      process.exit(1);
    }

    const verseDir = join(cwd, VERSE_DIR);
    mkdirSync(join(verseDir, NODES_DIR), { recursive: true });
    mkdirSync(join(verseDir, 'rdf'), { recursive: true });
    mkdirSync(join(verseDir, 'snapshots'), { recursive: true });

    const manifest = {
      name,
      version: '0.1.0',
      protocol: 'verse-protocol',
      namespace: 'https://ns.foxximediums.com/verse#',
      created: timestamp(),
      author: {
        name: process.env.USER || process.env.USERNAME || 'unknown',
        webId: null,
        ethereumAddress: null,
        did: null,
      },
      epoch: 0,
    };
    writeManifest(cwd, manifest);

    // Create root node
    const rootNode = {
      id: 'v1',
      type,
      label: name,
      author: manifest.author.name,
      depth: 0,
      epoch: 1,
      created: timestamp(),
      commitHash: gitHash(),
      branch: gitBranch(),
      desc: `Root ${type.toLowerCase()} for ${name}.`,
    };
    saveNode(cwd, rootNode);

    // Copy ontology if available
    const ontologySrc = join(resolve(import.meta.dirname, '../../..'), 'ontology', 'verse-ontology.ttl');
    if (existsSync(ontologySrc)) {
      const dest = join(verseDir, 'verse-ontology.ttl');
      writeFileSync(dest, readFileSync(ontologySrc));
    }

    console.log(`\n  ◆ VERSE PROTOCOL — Initialized\n`);
    console.log(`  Name:    ${name}`);
    console.log(`  Type:    ${type}`);
    console.log(`  Root:    ${rootNode.id}`);
    console.log(`  Dir:     ${VERSE_DIR}/`);
    console.log(`\n  Next: verse extend v1 "My First Extension"\n`);
  },

  extend() {
    const parentId = args[1];
    const name = args[2];
    if (!parentId || !name) {
      console.error('Usage: verse extend <parent-id> <name> [type]');
      process.exit(1);
    }
    createDerivation('extends', parentId, name, args[3]);
  },

  fork() {
    const parentId = args[1];
    const name = args[2];
    if (!parentId || !name) {
      console.error('Usage: verse fork <parent-id> <name> [type]');
      process.exit(1);
    }
    createDerivation('forks', parentId, name, args[3]);
  },

  merge() {
    const name = args[1];
    const parentIds = args.slice(2);
    if (!name || parentIds.length < 2) {
      console.error('Usage: verse merge <name> <parent1> <parent2> [parent3...]');
      process.exit(1);
    }

    const root = verseRoot();
    if (!root) { console.error('Not inside a verse repo. Run `verse init` first.'); process.exit(1); }

    const nodes = loadNodes(root);
    const manifest = readManifest(root);

    for (const pid of parentIds) {
      if (!nodes.find(n => n.id === pid)) {
        console.error(`Parent "${pid}" not found.`);
        process.exit(1);
      }
    }

    const maxDepth = Math.max(...parentIds.map(pid => {
      const p = nodes.find(n => n.id === pid);
      return p ? p.depth : 0;
    }));

    const node = {
      id: nextId(nodes),
      type: 'Verse',
      label: name,
      author: manifest.author.name,
      depth: maxDepth + 1,
      epoch: (manifest.epoch || 0) + 1,
      parents: parentIds,
      relation: 'merges',
      created: timestamp(),
      commitHash: gitHash(),
      branch: gitBranch(),
      desc: `Merge of ${parentIds.join(', ')}.`,
    };

    manifest.epoch = node.epoch;
    writeManifest(root, manifest);
    saveNode(root, node);

    console.log(`\n  ◇ Merged → ${node.id}: "${name}"`);
    console.log(`  Parents: ${parentIds.join(' + ')}`);
    console.log(`  Epoch:   ${node.epoch}\n`);
  },

  score() {
    const root = verseRoot();
    if (!root) { console.error('Not inside a verse repo.'); process.exit(1); }

    const nodes = loadNodes(root);
    if (nodes.length === 0) { console.log('No nodes found.'); return; }

    const scores = computeInfluence(nodes);
    const sorted = [...nodes].sort((a, b) => (scores[b.id]?.total || 0) - (scores[a.id]?.total || 0));

    console.log(`\n  ◆ INFLUENCE SCORES — ${nodes.length} nodes\n`);
    console.log('  #   ID    Label                  Depth  Reuse  Merge%  Novel   TOTAL');
    console.log('  ' + '─'.repeat(78));

    sorted.forEach((n, i) => {
      const s = scores[n.id];
      const rank = `${i + 1}`.padStart(2);
      const id = n.id.padEnd(5);
      const label = n.label.substring(0, 22).padEnd(22);
      const depth = `${s.forkDepth}`.padStart(5);
      const reuse = `${s.reuseCount}`.padStart(5);
      const merge = `${(s.mergeCentrality * 100).toFixed(0)}%`.padStart(6);
      const novel = s.noveltyDelta.toFixed(2).padStart(7);
      const total = s.total.toFixed(3).padStart(7);
      console.log(`  ${rank}  ${id}  ${label} ${depth} ${reuse} ${merge} ${novel}  ${total}`);
    });

    // Compute and save Merkle root
    buildMerkleRoot(scores).then(merkle => {
      const snapshot = {
        epoch: readManifest(root)?.epoch || 0,
        computedAt: timestamp(),
        merkleRoot: merkle,
        scores: Object.fromEntries(
          Object.entries(scores).map(([id, s]) => [id, { total: s.total, normalized: s.normalized }])
        ),
      };

      const snapDir = join(root, VERSE_DIR, 'snapshots');
      mkdirSync(snapDir, { recursive: true });
      writeFileSync(join(snapDir, `epoch-${snapshot.epoch}.json`), JSON.stringify(snapshot, null, 2));

      console.log(`\n  Merkle root: ${merkle.substring(0, 16)}...${merkle.substring(48)}`);
      console.log(`  Snapshot saved: ${VERSE_DIR}/snapshots/epoch-${snapshot.epoch}.json\n`);
    });
  },

  status() {
    const root = verseRoot();
    if (!root) { console.error('Not inside a verse repo.'); process.exit(1); }

    const manifest = readManifest(root);
    const nodes = loadNodes(root);

    console.log(`\n  ◆ VERSE STATUS`);
    console.log(`  Name:    ${manifest?.name || '?'}`);
    console.log(`  Author:  ${manifest?.author?.name || '?'}`);
    console.log(`  Epoch:   ${manifest?.epoch || 0}`);
    console.log(`  Nodes:   ${nodes.length}`);

    if (nodes.length > 0) {
      console.log(`\n  DAG:`);
      const sorted = [...nodes].sort((a, b) => (a.epoch || 0) - (b.epoch || 0));
      for (const n of sorted) {
        const parents = n.parents ? ` ← ${n.parents.join(', ')}` : '';
        const rel = n.relation ? ` [${n.relation}]` : ' [origin]';
        console.log(`    ${n.id}  ${n.type.padEnd(10)} ${n.label}${rel}${parents}`);
      }
    }
    console.log();
  },

  attest() {
    const root = verseRoot();
    if (!root) { console.error('Not inside a verse repo.'); process.exit(1); }

    const manifest = readManifest(root);
    const nodes = loadNodes(root);

    console.log(`\n  ◆ EAS ATTESTATION DATA\n`);
    console.log('  Schema: verse-authorship-v1');
    console.log(`  Attester: ${manifest?.author?.ethereumAddress || '<set ethereumAddress in .verse/manifest.json>'}\n`);

    for (const n of nodes) {
      console.log(`  ${n.id}: ${n.label}`);
      console.log(`    type: ${n.type}`);
      console.log(`    commit: ${n.commitHash || 'n/a'}`);
      console.log(`    attestation: verse:${n.id}:${n.commitHash?.substring(0, 8) || 'local'}`);
      console.log();
    }

    console.log('  To submit on-chain, set your ethereumAddress in .verse/manifest.json');
    console.log('  and use the EAS SDK: https://docs.attest.sh\n');
  },

  help() {
    console.log(`
  ◆ VERSE PROTOCOL CLI v0.1

  Commands:
    init <name> [type]           Initialize a verse repo (default type: World)
    extend <parent> <name>       Create an extension of a parent verse
    fork <parent> <name>         Create a divergent fork
    merge <name> <p1> <p2>...    Merge multiple verses into one
    score                        Compute influence scores + Merkle snapshot
    status                       Show current verse DAG
    attest                       Generate EAS attestation data

  Types: ${NARRATIVE_TYPES.join(', ')}
  Relations: ${RELATION_TYPES.join(', ')}

  Examples:
    verse init "Ashenmere" World
    verse extend v1 "Pyro-Linguistics" System
    verse fork v1 "Dark Ashenmere" World
    verse merge "The Convergence" v2 v3
    verse score
`);
  },
};

function createDerivation(relation, parentId, name, type) {
  const root = verseRoot();
  if (!root) { console.error('Not inside a verse repo. Run `verse init` first.'); process.exit(1); }

  const nodes = loadNodes(root);
  const manifest = readManifest(root);
  const parent = nodes.find(n => n.id === parentId);

  if (!parent) {
    console.error(`Parent "${parentId}" not found. Run \`verse status\` to see nodes.`);
    process.exit(1);
  }

  const nodeType = type || (relation === 'forks' ? parent.type : 'Verse');
  if (!NARRATIVE_TYPES.includes(nodeType)) {
    console.error(`Unknown type "${nodeType}". Valid: ${NARRATIVE_TYPES.join(', ')}`);
    process.exit(1);
  }

  const node = {
    id: nextId(nodes),
    type: nodeType,
    label: name,
    author: manifest.author.name,
    depth: parent.depth + 1,
    epoch: (manifest.epoch || 0) + 1,
    parents: [parentId],
    relation,
    created: timestamp(),
    commitHash: gitHash(),
    branch: gitBranch(),
    desc: `${relation === 'forks' ? 'Fork' : 'Extension'} of ${parent.label}.`,
  };

  manifest.epoch = node.epoch;
  writeManifest(root, manifest);
  saveNode(root, node);

  const symbol = relation === 'forks' ? '⚡' : '◇';
  console.log(`\n  ${symbol} ${relation === 'forks' ? 'Forked' : 'Extended'} → ${node.id}: "${name}"`);
  console.log(`  Parent: ${parentId} (${parent.label})`);
  console.log(`  Type:   ${nodeType}`);
  console.log(`  Epoch:  ${node.epoch}\n`);
}

// ─── Dispatch ───

if (!cmd || cmd === 'help' || cmd === '--help' || cmd === '-h') {
  commands.help();
} else if (commands[cmd]) {
  commands[cmd]();
} else {
  console.error(`Unknown command: ${cmd}. Run \`verse help\` for usage.`);
  process.exit(1);
}
