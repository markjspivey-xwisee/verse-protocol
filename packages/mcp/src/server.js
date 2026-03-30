#!/usr/bin/env node

/**
 * Verse Protocol MCP Server
 *
 * Exposes verse world-building operations as MCP tools for AI agents.
 * Works with Claude Code, Cline, and any MCP-compatible client.
 *
 * Tools:
 *   verse_status      — view the current DAG
 *   verse_score       — compute influence scores
 *   verse_extend      — extend an existing node
 *   verse_fork        — fork a node (divergent branch)
 *   verse_merge       — merge multiple nodes
 *   verse_read_lore   — read a node's full content
 *   verse_affordances — detect expansion opportunities
 *   verse_search      — search nodes by label/type/author
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'fs';
import { join, resolve } from 'path';
import { execSync } from 'child_process';

// Find verse root
function findVerseRoot(from = process.cwd()) {
  let dir = from;
  while (dir !== resolve(dir, '..')) {
    if (existsSync(join(dir, '.verse'))) return dir;
    dir = resolve(dir, '..');
  }
  return null;
}

function loadNodes(root) {
  const dir = join(root, '.verse', 'nodes');
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter(f => f.endsWith('.json'))
    .map(f => JSON.parse(readFileSync(join(dir, f), 'utf-8')));
}

function loadContent(root, nodeId) {
  const p = join(root, '.verse', 'content', `${nodeId}.md`);
  return existsSync(p) ? readFileSync(p, 'utf-8') : null;
}

function loadManifest(root) {
  const p = join(root, '.verse', 'manifest.json');
  return existsSync(p) ? JSON.parse(readFileSync(p, 'utf-8')) : null;
}

function nextId(nodes) {
  const max = nodes.reduce((m, n) => {
    const num = parseInt(n.id.replace('v', ''), 10);
    return num > m ? num : m;
  }, 0);
  return `v${max + 1}`;
}

function escapeRdf(s) {
  return (s || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function saveNode(root, node) {
  const nodesDir = join(root, '.verse', 'nodes');
  mkdirSync(nodesDir, { recursive: true });
  writeFileSync(join(nodesDir, `${node.id}.json`), JSON.stringify(node, null, 2));

  const rdfDir = join(root, '.verse', 'rdf');
  mkdirSync(rdfDir, { recursive: true });
  const parentTriples = (node.parents || [])
    .map(p => `    verse:${node.relation || 'extends'} <${p}> ;`)
    .join('\n');
  const rdf = `@prefix verse: <https://ns.foxximediums.com/verse#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .

<${node.id}> a verse:${node.type} ;
    rdfs:label "${escapeRdf(node.label)}"@en ;
    rdfs:comment """${escapeRdf(node.desc)}"""@en ;
    verse:authoredBy <agent:mcp> ;
${parentTriples.replace(/ ;$/, ' .')}
`;
  writeFileSync(join(rdfDir, `${node.id}.ttl`), rdf);
}

function saveContent(root, nodeId, content) {
  const dir = join(root, '.verse', 'content');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${nodeId}.md`), content);
}

function detectAffordances(nodes) {
  const childTypeMap = {};
  for (const n of nodes) childTypeMap[n.id] = new Set();
  for (const n of nodes) {
    if (n.parents) {
      for (const pid of n.parents) {
        if (childTypeMap[pid]) childTypeMap[pid].add(n.type);
      }
    }
  }

  const affordances = [];
  for (const n of nodes) {
    const ct = childTypeMap[n.id];
    if ((n.type === 'World' || n.type === 'Location') && !ct.has('Location'))
      affordances.push({ parentId: n.id, parentLabel: n.label, type: 'unexplored_region', suggestedType: 'Location', relation: 'extends' });
    if ((n.type === 'Location' || n.type === 'Faction') && !ct.has('Character'))
      affordances.push({ parentId: n.id, parentLabel: n.label, type: 'character_vacancy', suggestedType: 'Character', relation: 'extends' });
    if ((n.type === 'Character' || n.type === 'Event') && !ct.has('Verse') && !ct.has('Event'))
      affordances.push({ parentId: n.id, parentLabel: n.label, type: 'open_plotline', suggestedType: 'Verse', relation: 'extends' });
    if (n.type === 'World' && !ct.has('System'))
      affordances.push({ parentId: n.id, parentLabel: n.label, type: 'undefined_system', suggestedType: 'System', relation: 'extends' });
  }
  return affordances;
}

// --- MCP Server Setup ---

const server = new Server(
  { name: 'verse-protocol', version: '0.1.0' },
  { capabilities: { tools: {}, resources: {} } }
);

const TYPES = ['World', 'Verse', 'Character', 'Location', 'System', 'Event', 'Artifact', 'Faction', 'Timeline'];

// Register tools
server.setRequestHandler('tools/list', async () => ({
  tools: [
    {
      name: 'verse_status',
      description: 'View the current verse DAG — all nodes, their types, relations, and parent connections',
      inputSchema: { type: 'object', properties: {} },
    },
    {
      name: 'verse_score',
      description: 'Compute and display influence scores for all nodes in the DAG',
      inputSchema: { type: 'object', properties: {} },
    },
    {
      name: 'verse_extend',
      description: 'Create a new narrative object that extends an existing node (adds without contradicting)',
      inputSchema: {
        type: 'object',
        properties: {
          parentId: { type: 'string', description: 'ID of the parent node (e.g., "v1")' },
          name: { type: 'string', description: 'Name of the new narrative object' },
          type: { type: 'string', enum: TYPES, description: 'Type of narrative object' },
          description: { type: 'string', description: 'Short description' },
          content: { type: 'string', description: 'Full lore/prose markdown content (optional)' },
        },
        required: ['parentId', 'name', 'type', 'description'],
      },
    },
    {
      name: 'verse_fork',
      description: 'Create a divergent fork from an existing node (modifies or contradicts canon)',
      inputSchema: {
        type: 'object',
        properties: {
          parentId: { type: 'string', description: 'ID of the parent node' },
          name: { type: 'string', description: 'Name of the fork' },
          type: { type: 'string', enum: TYPES },
          description: { type: 'string' },
          content: { type: 'string', description: 'Full lore content (optional)' },
        },
        required: ['parentId', 'name', 'type', 'description'],
      },
    },
    {
      name: 'verse_merge',
      description: 'Synthesize multiple nodes into a new unified verse (highest creativity signal)',
      inputSchema: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Name of the merged verse' },
          parentIds: { type: 'array', items: { type: 'string' }, description: 'IDs of nodes to merge (minimum 2)' },
          description: { type: 'string' },
          content: { type: 'string', description: 'Full lore content (optional)' },
        },
        required: ['name', 'parentIds', 'description'],
      },
    },
    {
      name: 'verse_read_lore',
      description: 'Read the full lore/prose content for a specific node',
      inputSchema: {
        type: 'object',
        properties: {
          nodeId: { type: 'string', description: 'Node ID (e.g., "v1")' },
        },
        required: ['nodeId'],
      },
    },
    {
      name: 'verse_affordances',
      description: 'Detect expansion opportunities — gaps in the world that invite new content',
      inputSchema: { type: 'object', properties: {} },
    },
    {
      name: 'verse_search',
      description: 'Search nodes by label, type, or author',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search query (matches label, type, author, description)' },
        },
        required: ['query'],
      },
    },
  ],
}));

// Handle tool calls
server.setRequestHandler('tools/call', async (request) => {
  const { name, arguments: args } = request.params;
  const root = findVerseRoot();

  if (!root) {
    return { content: [{ type: 'text', text: 'Error: Not inside a verse repo. Run `npm run verse -- init "Name" World` first.' }] };
  }

  const nodes = loadNodes(root);
  const manifest = loadManifest(root);
  const byId = Object.fromEntries(nodes.map(n => [n.id, n]));

  switch (name) {
    case 'verse_status': {
      const sorted = [...nodes].sort((a, b) => (a.epoch || 0) - (b.epoch || 0));
      const lines = [
        `VERSE STATUS — ${manifest?.name || '?'}`,
        `Author: ${manifest?.author?.name || '?'} | Epoch: ${manifest?.epoch || 0} | Nodes: ${nodes.length}`,
        '',
        ...sorted.map(n => {
          const parents = n.parents ? ` ← ${n.parents.join(', ')}` : '';
          const rel = n.relation ? ` [${n.relation}]` : ' [origin]';
          return `  ${n.id}  ${n.type.padEnd(10)} ${n.label}${rel}${parents}`;
        }),
      ];
      return { content: [{ type: 'text', text: lines.join('\n') }] };
    }

    case 'verse_score': {
      try {
        const output = execSync('node packages/cli/bin/verse.js score', {
          cwd: root, encoding: 'utf-8', timeout: 30000,
        });
        return { content: [{ type: 'text', text: output }] };
      } catch (e) {
        return { content: [{ type: 'text', text: `Scoring error: ${e.message}` }] };
      }
    }

    case 'verse_extend':
    case 'verse_fork': {
      const parent = byId[args.parentId];
      if (!parent) return { content: [{ type: 'text', text: `Parent "${args.parentId}" not found.` }] };

      const relation = name === 'verse_fork' ? 'forks' : 'extends';
      const node = {
        id: nextId(nodes),
        type: args.type,
        label: args.name,
        author: 'mcp-agent',
        depth: (parent.depth || 0) + 1,
        epoch: (manifest.epoch || 0) + 1,
        parents: [args.parentId],
        relation,
        created: new Date().toISOString(),
        desc: args.description,
      };

      manifest.epoch = node.epoch;
      writeFileSync(join(root, '.verse', 'manifest.json'), JSON.stringify(manifest, null, 2));
      saveNode(root, node);

      if (args.content) {
        saveContent(root, node.id, args.content);
      }

      const symbol = relation === 'forks' ? '⚡' : '◇';
      return { content: [{ type: 'text', text: `${symbol} ${relation === 'forks' ? 'Forked' : 'Extended'} → ${node.id}: "${args.name}" (${args.type} ${relation} ${args.parentId})` }] };
    }

    case 'verse_merge': {
      if (!args.parentIds || args.parentIds.length < 2) {
        return { content: [{ type: 'text', text: 'Merge requires at least 2 parent IDs.' }] };
      }
      for (const pid of args.parentIds) {
        if (!byId[pid]) return { content: [{ type: 'text', text: `Parent "${pid}" not found.` }] };
      }

      const maxDepth = Math.max(...args.parentIds.map(pid => byId[pid]?.depth || 0));
      const node = {
        id: nextId(nodes),
        type: 'Verse',
        label: args.name,
        author: 'mcp-agent',
        depth: maxDepth + 1,
        epoch: (manifest.epoch || 0) + 1,
        parents: args.parentIds,
        relation: 'merges',
        created: new Date().toISOString(),
        desc: args.description,
      };

      manifest.epoch = node.epoch;
      writeFileSync(join(root, '.verse', 'manifest.json'), JSON.stringify(manifest, null, 2));
      saveNode(root, node);

      if (args.content) {
        saveContent(root, node.id, args.content);
      }

      return { content: [{ type: 'text', text: `◈ Merged → ${node.id}: "${args.name}" (merges ${args.parentIds.join(' + ')})` }] };
    }

    case 'verse_read_lore': {
      const node = byId[args.nodeId];
      if (!node) return { content: [{ type: 'text', text: `Node "${args.nodeId}" not found.` }] };

      const content = loadContent(root, args.nodeId);
      const lines = [
        `${node.type}: ${node.label} (${args.nodeId})`,
        `Relation: ${node.relation || 'origin'} | Epoch: ${node.epoch} | Author: ${node.author}`,
        '',
        node.desc,
      ];

      if (content) {
        lines.push('', '--- FULL LORE ---', '', content);
      }

      return { content: [{ type: 'text', text: lines.join('\n') }] };
    }

    case 'verse_affordances': {
      const affs = detectAffordances(nodes);
      if (affs.length === 0) {
        return { content: [{ type: 'text', text: 'No expansion opportunities detected. The world is well-covered!' }] };
      }

      const lines = [
        `EXPANSION OPPORTUNITIES — ${affs.length} found`,
        '',
        ...affs.map(a =>
          `  ${a.type.padEnd(22)} → Create ${a.suggestedType} in ${a.parentLabel} (${a.parentId})`
        ),
      ];
      return { content: [{ type: 'text', text: lines.join('\n') }] };
    }

    case 'verse_search': {
      const q = (args.query || '').toLowerCase();
      const matches = nodes.filter(n =>
        n.label.toLowerCase().includes(q) ||
        n.type.toLowerCase().includes(q) ||
        (n.author || '').toLowerCase().includes(q) ||
        (n.desc || '').toLowerCase().includes(q)
      );

      if (matches.length === 0) {
        return { content: [{ type: 'text', text: `No nodes matching "${args.query}".` }] };
      }

      const lines = matches.map(n =>
        `  ${n.id}  ${n.type.padEnd(10)} ${n.label} — ${(n.desc || '').substring(0, 80)}`
      );
      return { content: [{ type: 'text', text: `Found ${matches.length} node(s):\n\n${lines.join('\n')}` }] };
    }

    default:
      return { content: [{ type: 'text', text: `Unknown tool: ${name}` }] };
  }
});

// Resources: expose verse nodes as readable resources
server.setRequestHandler('resources/list', async () => {
  const root = findVerseRoot();
  if (!root) return { resources: [] };

  const nodes = loadNodes(root);
  return {
    resources: nodes.map(n => ({
      uri: `verse://${n.id}`,
      name: `${n.type}: ${n.label}`,
      description: n.desc,
      mimeType: 'text/markdown',
    })),
  };
});

server.setRequestHandler('resources/read', async (request) => {
  const root = findVerseRoot();
  if (!root) return { contents: [] };

  const nodeId = request.params.uri.replace('verse://', '');
  const content = loadContent(root, nodeId);
  const nodes = loadNodes(root);
  const node = nodes.find(n => n.id === nodeId);

  if (!node) return { contents: [] };

  const text = content || `# ${node.label}\n\n${node.desc}`;
  return {
    contents: [{
      uri: request.params.uri,
      mimeType: 'text/markdown',
      text,
    }],
  };
});

// Start server
const transport = new StdioServerTransport();
await server.connect(transport);
