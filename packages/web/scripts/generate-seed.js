#!/usr/bin/env node

/**
 * Reads .verse/nodes/, .verse/content/, and .verse/authors/
 * and generates the seed data module for the web explorer.
 */

import { readFileSync, writeFileSync, readdirSync, existsSync } from 'fs';
import { join, resolve } from 'path';

const ROOT = resolve(import.meta.dirname, '../../..');
const NODES_DIR = join(ROOT, '.verse', 'nodes');
const CONTENT_DIR = join(ROOT, '.verse', 'content');
const AUTHORS_DIR = join(ROOT, '.verse', 'authors');
const OUTPUT = join(ROOT, 'packages', 'web', 'src', 'data', 'seed.js');

// Load nodes
const nodes = readdirSync(NODES_DIR)
  .filter(f => f.endsWith('.json'))
  .map(f => JSON.parse(readFileSync(join(NODES_DIR, f), 'utf-8')))
  .sort((a, b) => (a.epoch || 0) - (b.epoch || 0));

// Load content files
const content = {};
if (existsSync(CONTENT_DIR)) {
  for (const f of readdirSync(CONTENT_DIR).filter(f => f.endsWith('.md'))) {
    const id = f.replace('.md', '');
    const raw = readFileSync(join(CONTENT_DIR, f), 'utf-8');
    content[id] = raw;
  }
}

// Load author profiles
const authors = {};
if (existsSync(AUTHORS_DIR)) {
  for (const f of readdirSync(AUTHORS_DIR).filter(f => f.endsWith('.json'))) {
    const profile = JSON.parse(readFileSync(join(AUTHORS_DIR, f), 'utf-8'));
    authors[profile.github] = {
      name: profile.displayName || profile.github,
      color: generateColor(profile.github),
      eth: profile.identities?.ethereum?.address || '—',
    };
  }
}

// Collect unique authors from nodes
const PALETTE = ['#ff6b35', '#00d4aa', '#7b68ee', '#ff4081', '#c8b6ff', '#06b6d4', '#f59e0b', '#4ade80', '#f43f5e', '#818cf8'];
let colorIdx = 0;

const allAuthors = {};
for (const n of nodes) {
  const key = n.githubAuthor || n.author || 'unknown';
  if (!allAuthors[key]) {
    if (authors[key]) {
      allAuthors[key] = authors[key];
    } else {
      allAuthors[key] = {
        name: n.author || key,
        color: PALETTE[colorIdx % PALETTE.length],
        eth: '—',
      };
      colorIdx++;
    }
  }
}

function generateColor(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const h = Math.abs(hash) % 360;
  return `hsl(${h}, 70%, 60%)`;
}

// Extract a short description from content markdown (first paragraph after the metadata)
function extractDesc(md) {
  const lines = md.split('\n');
  let inHeader = true;
  let desc = [];
  for (const line of lines) {
    if (inHeader && (line.startsWith('#') || line.startsWith('**') || line.startsWith('---') || line.trim() === '')) {
      if (line.startsWith('---') && desc.length === 0) continue;
      if (desc.length > 0 && line.trim() === '') break;
      continue;
    }
    inHeader = false;
    if (line.trim() === '' && desc.length > 0) break;
    if (line.startsWith('#')) break;
    desc.push(line.trim());
  }
  return desc.join(' ').substring(0, 300) || '';
}

// Build seed nodes array
const seedNodes = nodes.map(n => {
  const md = content[n.id];
  const desc = md ? extractDesc(md) : (n.desc || `${n.type}: ${n.label}`);

  const obj = {
    id: n.id,
    type: n.type,
    label: n.label,
    author: n.githubAuthor || n.author || 'unknown',
    depth: n.depth || 0,
    epoch: n.epoch || 0,
    desc: desc,
  };
  if (n.parents?.length) obj.parents = n.parents;
  if (n.relation) obj.relation = n.relation;
  if (md) obj.hasContent = true;
  return obj;
});

// Build content map (truncated for bundle size)
const contentMap = {};
for (const [id, md] of Object.entries(content)) {
  contentMap[id] = md;
}

// Generate output
const output = `/**
 * Auto-generated from .verse/ data — do not edit manually.
 * Generated at: ${new Date().toISOString()}
 * Nodes: ${seedNodes.length}
 * Authors: ${Object.keys(allAuthors).length}
 */

export const AUTHORS = ${JSON.stringify(allAuthors, null, 2)};

export const SEED_NODES = ${JSON.stringify(seedNodes, null, 2)};

export const CONTENT = ${JSON.stringify(contentMap, null, 2)};
`;

writeFileSync(OUTPUT, output);
console.log(`Generated seed.js: ${seedNodes.length} nodes, ${Object.keys(allAuthors).length} authors, ${Object.keys(contentMap).length} content files`);
