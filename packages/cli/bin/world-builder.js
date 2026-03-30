#!/usr/bin/env node

/**
 * World Builder Agent — standalone Node.js script
 *
 * Analyses the .verse DAG, detects affordances (unexplored regions,
 * character vacancies, open plotlines), then generates lore-consistent
 * nodes directly (JSON + RDF + content markdown) and updates the manifest.
 *
 * Usage:
 *   node packages/cli/bin/world-builder.js [--max N]
 *
 * Flags:
 *   --max N   Maximum number of proposals to create (default: 2)
 */

import fs from 'fs';
import path from 'path';

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------
function parseArgs() {
  const args = process.argv.slice(2);
  let max = 2;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--max' && args[i + 1] != null) {
      max = parseInt(args[i + 1], 10);
      if (Number.isNaN(max) || max < 1) max = 2;
    }
  }
  return { max };
}

const { max: MAX_PROPOSALS } = parseArgs();

// ---------------------------------------------------------------------------
// Resolve .verse root (walk up until we find .verse/)
// ---------------------------------------------------------------------------
function findVerseRoot(startDir) {
  let dir = startDir;
  while (true) {
    if (fs.existsSync(path.join(dir, '.verse', 'manifest.json'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break; // reached filesystem root
    dir = parent;
  }
  // Fall back to cwd
  return process.cwd();
}

const ROOT = findVerseRoot(process.cwd());
const VERSE_DIR = path.join(ROOT, '.verse');
const nodesDir = path.join(VERSE_DIR, 'nodes');
const contentDir = path.join(VERSE_DIR, 'content');
const rdfDir = path.join(VERSE_DIR, 'rdf');

// ---------------------------------------------------------------------------
// Load all verse data
// ---------------------------------------------------------------------------
const nodeFiles = fs.readdirSync(nodesDir).filter(f => f.endsWith('.json'));
const nodes = nodeFiles.map(f =>
  JSON.parse(fs.readFileSync(path.join(nodesDir, f), 'utf-8'))
);
const byId = Object.fromEntries(nodes.map(n => [n.id, n]));

// Load content for context
const content = {};
if (fs.existsSync(contentDir)) {
  for (const f of fs.readdirSync(contentDir).filter(f => f.endsWith('.md'))) {
    content[f.replace('.md', '')] = fs.readFileSync(
      path.join(contentDir, f),
      'utf-8'
    );
  }
}

// Load manifest
const manifestPath = path.join(VERSE_DIR, 'manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));

// Compute max existing numeric id
const maxId = nodes.reduce((mx, n) => {
  const num = parseInt(String(n.id).replace(/^v/, ''), 10);
  return Number.isNaN(num) ? mx : Math.max(mx, num);
}, 0);

// ---------------------------------------------------------------------------
// Build child map
// ---------------------------------------------------------------------------
const childMap = {};
const childTypeMap = {};
for (const n of nodes) {
  childMap[n.id] = [];
  childTypeMap[n.id] = new Set();
}
for (const n of nodes) {
  if (n.parents) {
    for (const pid of n.parents) {
      if (childMap[pid]) {
        childMap[pid].push(n.id);
        childTypeMap[pid].add(n.type);
      }
    }
  }
}

// Track forked nodes
const forkedNodes = new Set();
for (const n of nodes) {
  if (n.relation === 'forks' && n.parents) {
    for (const pid of n.parents) forkedNodes.add(pid);
  }
}

// ---------------------------------------------------------------------------
// Detect affordances
// ---------------------------------------------------------------------------
const affordances = [];

for (const n of nodes) {
  const childTypes = childTypeMap[n.id];

  if (
    (n.type === 'World' || n.type === 'Location') &&
    !childTypes.has('Location')
  ) {
    affordances.push({
      parentId: n.id,
      parentLabel: n.label,
      parentType: n.type,
      affordanceType: 'unexplored_region',
      suggestedType: 'Location',
      relation: 'extends',
      priority: n.type === 'World' ? 3 : 2,
    });
  }

  if (
    (n.type === 'Location' || n.type === 'Faction') &&
    !childTypes.has('Character')
  ) {
    affordances.push({
      parentId: n.id,
      parentLabel: n.label,
      parentType: n.type,
      affordanceType: 'character_vacancy',
      suggestedType: 'Character',
      relation: 'extends',
      priority: 2,
    });
  }

  if (
    (n.type === 'Character' || n.type === 'Event') &&
    !childTypes.has('Verse') &&
    !childTypes.has('Event')
  ) {
    affordances.push({
      parentId: n.id,
      parentLabel: n.label,
      parentType: n.type,
      affordanceType: 'open_plotline',
      suggestedType: 'Verse',
      relation: 'extends',
      priority: 1,
    });
  }
}

// Sort by priority (highest first), then randomize within same priority
affordances.sort((a, b) => {
  if (b.priority !== a.priority) return b.priority - a.priority;
  return Math.random() - 0.5;
});

// ---------------------------------------------------------------------------
// World-context helpers
// ---------------------------------------------------------------------------
function getWorldContext(parentId) {
  const parent = byId[parentId];
  if (!parent) return '';

  const lines = [];
  lines.push('=== WORLD RULES ===');

  // Walk up to find world root and collect all systems
  function collectContext(id, visited = new Set()) {
    if (visited.has(id)) return;
    visited.add(id);
    const node = byId[id];
    if (!node) return;

    if (content[id]) {
      const preview = content[id].substring(0, 500);
      lines.push(`\n--- ${node.type}: ${node.label} ---`);
      lines.push(preview);
    }

    if (node.type === 'System') {
      lines.push(`\n[SYSTEM RULES: ${node.label}]`);
      if (content[id]) lines.push(content[id].substring(0, 1000));
    }

    if (node.parents) {
      for (const pid of node.parents) collectContext(pid, visited);
    }
  }

  collectContext(parentId);

  // Also add sibling context
  if (parent.parents) {
    for (const pid of parent.parents) {
      for (const sibId of childMap[pid] || []) {
        if (sibId !== parentId && content[sibId]) {
          const sib = byId[sibId];
          lines.push(`\n--- Sibling ${sib.type}: ${sib.label} ---`);
          lines.push(content[sibId].substring(0, 300));
        }
      }
    }
  }

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Theme extraction
// ---------------------------------------------------------------------------
function extractThemes(text) {
  const keywords = [
    'fire', 'ash', 'burn', 'flame', 'cinder', 'smoke',
    'crystal', 'memory', 'depth', 'pressure', 'glass',
    'silence', 'meaning', 'language', 'water', 'ocean',
    'song', 'grammar',
  ];
  return keywords.filter(k => text.toLowerCase().includes(k));
}

// ---------------------------------------------------------------------------
// World-root / world-name helpers
// ---------------------------------------------------------------------------
function findWorldRoot(id, visited = new Set()) {
  if (visited.has(id)) return id;
  visited.add(id);
  const n = byId[id];
  if (!n) return id;
  if (n.type === 'World' && (!n.parents || n.parents.length === 0)) return id;
  if (n.parents && n.parents.length) return findWorldRoot(n.parents[0], visited);
  return id;
}

function findWorldName(id) {
  const rootId = findWorldRoot(id);
  return byId[rootId]?.label || 'Unknown';
}

// ---------------------------------------------------------------------------
// Description generators
// ---------------------------------------------------------------------------
function generateLocationDesc(name, parent, worldThemes, localThemes) {
  const isAsh = worldThemes.includes('fire') || worldThemes.includes('ash');
  const isGlass = worldThemes.includes('crystal') || worldThemes.includes('depth');

  if (isAsh) {
    return `${name} lies within the reaches of ${parent.label}. The walls here bear ash-text older than any in the upper levels \u2014 not the careful calligraphy of deliberate burns, but wild, ungrammatical scrawls left by fires that spoke without being asked. The air tastes of ancient smoke. Something was said here, long ago, that no one was meant to hear. Pyro-linguists who visit report hearing a low hum in frequencies that don\u2019t correspond to any known flame color \u2014 a grammar that predates the Flame Grammar tiles themselves.`;
  } else if (isGlass) {
    return `${name} exists at a depth where the crystal formations take on unusual geometries \u2014 not the hexagonal lattices of joy or the monoclinic structures of grief, but something older. A spiral pattern that Depth Singers have never catalogued. The water here is warmer than it should be at this pressure, and the crystals produce harmonics even when no one is singing to them. Some believe this is where the ocean first began to remember.`;
  }
  return `${name} is a place of significance within ${parent.label}. Its full nature awaits discovery by those brave enough to explore it.`;
}

function generateCharacterDesc(name, parent, worldThemes, localThemes) {
  const isAsh = worldThemes.includes('fire') || worldThemes.includes('ash');
  const isGlass = worldThemes.includes('crystal') || worldThemes.includes('depth');

  if (isAsh) {
    return `${name} is a figure who exists at the margins of ${parent.label} \u2014 neither fully accepted by the orthodox pyro-linguists nor cast out by the Order of Cinders. They possess an unusual gift: they can hear fire-speech that has already faded, residual meaning that lingers in the air after ash has settled. While the Archivist reads ash by touch, ${name} reads the silence between burns. They believe that every conversation in fire leaves an echo, and these echoes accumulate into a kind of ambient meaning \u2014 a background hum of everything Ashenmere has ever said.`;
  } else if (isGlass) {
    return `${name} is a figure of Glassdeep who has spent so long at depth that their skin has taken on the translucent quality of the crystals they study. They are a specialist in a controversial technique: reading crystal memories not through song, but through prolonged physical contact \u2014 pressing their body against the formations and allowing the compressed memories to seep through their skin. The Depth Singers consider this practice crude, but ${name} has recovered memories from crystals that refused to respond to any frequency.`;
  }
  return `${name} is a mysterious figure connected to ${parent.label}. Their true nature and motivations remain to be fully explored.`;
}

function generateVerseDesc(name, parent, worldThemes, localThemes) {
  return `"${name}" is a narrative that emerges from the tensions within ${parent.label}. ${parent.desc || ''} This verse explores what happens when those tensions reach a breaking point \u2014 when the established order is challenged not by opposition, but by a truth that the existing framework cannot contain. The consequences ripple outward through the DAG, creating new possibilities for those who come after.`;
}

// ---------------------------------------------------------------------------
// Name generation
// ---------------------------------------------------------------------------

const LOCATION_NAMES = {
  'Ashenmere': [
    'The Ash Fields', 'The Ember Vaults', 'The Smoke Reaches',
    'The Cinder Wastes', 'The Flame Scriptorium', 'The Silent Hearth',
  ],
  'Glassdeep': [
    'The Pressure Gardens', 'The Crystal Narrows', 'The Singing Shelf',
    'The Abyssal Archive', 'The Melt Current',
  ],
};

const CHARACTER_NAMES = {
  'Ashenmere': [
    'The Kindler', 'The Ash Reader', 'The Flame Mute',
    'The Smoke Walker', 'The Cinder Scribe',
  ],
  'Glassdeep': [
    'The Pressure Singer', 'The Crystal Diver',
    'The Depth Listener', 'The Memory Walker',
  ],
};

const VERSE_NAMES = [
  'The Second Silence', 'When Ash Remembers', 'The Grammar of Loss',
  'What Fire Forgot', 'The Deepest Word', 'Burning Questions',
  'The Weight of Memory', 'Echoes in Crystal',
];

function generateName(aff, parent, allNodes, allContent) {
  const parentContent = allContent[parent.id] || '';
  const worldRoot = findWorldRoot(parent.id);
  const worldContent = allContent[worldRoot] || '';

  const themes = extractThemes(parentContent);
  const worldThemes = extractThemes(worldContent);
  const worldName = findWorldName(parent.id);

  let name, description;

  switch (aff.suggestedType) {
    case 'Location': {
      const pool = LOCATION_NAMES[worldName] || LOCATION_NAMES['Ashenmere'];
      const existing = new Set(allNodes.map(n => n.label));
      name =
        pool.find(n => !existing.has(n)) ||
        `The ${themes[0] || 'Hidden'} ${['Chamber', 'Gate', 'Archive', 'Path', 'Threshold'][Math.floor(Math.random() * 5)]}`;
      description = generateLocationDesc(name, parent, worldThemes, themes);
      break;
    }
    case 'Character': {
      const pool = CHARACTER_NAMES[worldName] || CHARACTER_NAMES['Ashenmere'];
      const existing = new Set(allNodes.map(n => n.label));
      name =
        pool.find(n => !existing.has(n)) ||
        `The ${themes[0] || 'Unknown'} ${['Keeper', 'Wanderer', 'Scholar', 'Guardian'][Math.floor(Math.random() * 4)]}`;
      description = generateCharacterDesc(name, parent, worldThemes, themes);
      break;
    }
    case 'Verse': {
      const existing = new Set(allNodes.map(n => n.label));
      name =
        VERSE_NAMES.find(n => !existing.has(n)) ||
        `The ${themes[0] || 'Untold'} ${['Chapter', 'Fragment', 'Reckoning'][Math.floor(Math.random() * 3)]}`;
      description = generateVerseDesc(name, parent, worldThemes, themes);
      break;
    }
    default: {
      name = `${aff.suggestedType} of ${parent.label}`;
      description = `A ${aff.suggestedType.toLowerCase()} connected to ${parent.label}. ${parent.desc || ''}`;
    }
  }

  return { name, description };
}

// ---------------------------------------------------------------------------
// RDF helper
// ---------------------------------------------------------------------------
function escapeRdf(s) {
  return (s || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

// ---------------------------------------------------------------------------
// Type templates (kept for reference / future LLM integration)
// ---------------------------------------------------------------------------
const TYPE_TEMPLATES = {
  Location: (parent, ctx) => ({
    name_hint: `a place within ${parent.label}`,
    desc_prompt: `Create a location within ${parent.label}. It should feel like it belongs in this world, following the established rules and tone. What makes this place unique? Who or what might be found here? What is its significance?`,
  }),
  Character: (parent, ctx) => ({
    name_hint: `someone who inhabits or is connected to ${parent.label}`,
    desc_prompt: `Create a character connected to ${parent.label}. What is their role? What drives them? How do they relate to the established world rules and existing characters? Give them depth \u2014 appearance, motivation, abilities, and a distinctive voice.`,
  }),
  Verse: (parent, ctx) => ({
    name_hint: `a narrative continuing from ${parent.label}`,
    desc_prompt: `Write a narrative verse continuing from ${parent.label}. What happens next? How does it develop the existing tensions and themes? Reference specific world rules and elements from the lore.`,
  }),
  System: (parent, ctx) => ({
    name_hint: `a rule system governing ${parent.label}`,
    desc_prompt: `Define a system of rules, magic, or mechanics for ${parent.label}. How does it work? What are its constraints? How does it interact with existing systems?`,
  }),
};

// ---------------------------------------------------------------------------
// Main: generate proposals and write files
// ---------------------------------------------------------------------------
let proposalCount = 0;

for (const aff of affordances) {
  if (proposalCount >= MAX_PROPOSALS) break;

  const parent = byId[aff.parentId];
  const worldContext = getWorldContext(aff.parentId);
  const template = TYPE_TEMPLATES[aff.suggestedType] || TYPE_TEMPLATES.Verse;
  const hints = template(parent, worldContext);

  const names = generateName(aff, parent, nodes, content);

  // --- DIRECTLY CREATE NODE ---
  const newId = `v${maxId + 1 + proposalCount}`;
  const newEpoch = (manifest.epoch || 0) + 1 + proposalCount;
  const parentDepth = parent.depth || 0;

  const node = {
    id: newId,
    type: aff.suggestedType,
    label: names.name,
    author: 'World Builder Agent',
    depth: parentDepth + 1,
    epoch: newEpoch,
    parents: [aff.parentId],
    relation: aff.relation,
    created: new Date().toISOString(),
    desc: names.description,
    agentAuthored: true,
  };

  // Write node JSON
  fs.writeFileSync(
    path.join(nodesDir, `${newId}.json`),
    JSON.stringify(node, null, 2)
  );

  // Write RDF with @prefix rdfs:
  const rdf = [
    '@prefix verse: <https://ns.foxximediums.com/verse#> .',
    '@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .',
    '@prefix dcterms: <http://purl.org/dc/terms/> .',
    '',
    `<${newId}> a verse:${aff.suggestedType} ;`,
    `    rdfs:label "${escapeRdf(names.name)}"@en ;`,
    `    rdfs:comment """${escapeRdf(names.description)}"""@en ;`,
    '    verse:authoredBy <agent:world-builder> ;',
    `    verse:${aff.relation} <${aff.parentId}> .`,
    '',
  ].join('\n');

  if (!fs.existsSync(rdfDir)) fs.mkdirSync(rdfDir, { recursive: true });
  fs.writeFileSync(path.join(rdfDir, `${newId}.ttl`), rdf);

  // Write content markdown
  if (!fs.existsSync(contentDir)) fs.mkdirSync(contentDir, { recursive: true });
  const contentMd = [
    `# ${names.name}`,
    '',
    `**Type:** ${aff.suggestedType}`,
    `**Parent:** ${parent.label}`,
    `**Relation:** ${aff.relation}`,
    '**Author:** World Builder Agent',
    '',
    '---',
    '',
    names.description,
    '',
  ].join('\n');
  fs.writeFileSync(path.join(contentDir, `${newId}.md`), contentMd);

  // Update manifest epoch
  manifest.epoch = newEpoch;
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

  console.log(
    `Created node: ${newId} \u2014 ${names.name} (${aff.suggestedType} ${aff.relation} ${aff.parentId})`
  );
  proposalCount++;
}

console.log(`World Builder Agent created ${proposalCount} node(s) directly`);
process.exit(0);
