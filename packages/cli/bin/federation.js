#!/usr/bin/env node

/**
 * verse-federation — Cross-repo multiverse federation commands
 *
 * Commands:
 *   verse-federation discover <github-user>   Find other verse repos
 *   verse-federation link <repo-url> <node>   Link a remote verse to a local node
 *   verse-federation pull <repo-url>          Pull remote verse data for merging
 *   verse-federation status                   Show federation links
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'fs';
import { join, resolve } from 'path';
import { execSync } from 'child_process';

const args = process.argv.slice(2);
const cmd = args[0];
const cwd = process.cwd();

const VERSE_DIR = '.verse';
const FEDERATION_DIR = 'federation';

function verseRoot() {
  let dir = cwd;
  while (dir !== resolve(dir, '..')) {
    if (existsSync(join(dir, VERSE_DIR))) return dir;
    dir = resolve(dir, '..');
  }
  return null;
}

function ensureFederationDir(root) {
  const dir = join(root, VERSE_DIR, FEDERATION_DIR);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function loadFederationLinks(root) {
  const linksFile = join(root, VERSE_DIR, FEDERATION_DIR, 'links.json');
  if (existsSync(linksFile)) return JSON.parse(readFileSync(linksFile, 'utf-8'));
  return { links: [], discovered: [] };
}

function saveFederationLinks(root, data) {
  const dir = ensureFederationDir(root);
  writeFileSync(join(dir, 'links.json'), JSON.stringify(data, null, 2));
}

const commands = {
  async discover() {
    const username = args[1];
    if (!username) {
      console.error('Usage: verse-federation discover <github-username>');
      process.exit(1);
    }

    console.log(`\n  ◆ FEDERATION — Discovering verse repos by ${username}\n`);

    try {
      // Search for repos with .verse directories
      const result = execSync(
        `gh api "search/code?q=filename:manifest.json+path:.verse+user:${username}" --jq ".items[] | .repository.full_name"`,
        { encoding: 'utf-8', timeout: 15000 }
      ).trim();

      const repos = result ? [...new Set(result.split('\n'))] : [];

      if (repos.length === 0) {
        console.log('  No verse repos found for this user.');
        console.log('  (Repos need a .verse/manifest.json to be discoverable)\n');
        return;
      }

      console.log(`  Found ${repos.length} verse repo(s):\n`);

      for (const repo of repos) {
        try {
          const manifest = execSync(
            `gh api "repos/${repo}/contents/.verse/manifest.json" --jq ".content" | base64 -d`,
            { encoding: 'utf-8', timeout: 10000 }
          );
          const data = JSON.parse(manifest);
          console.log(`  ◆ ${repo}`);
          console.log(`    Name:   ${data.name || '?'}`);
          console.log(`    Epoch:  ${data.epoch || 0}`);
          console.log(`    Author: ${data.author?.name || '?'}`);
          console.log();
        } catch {
          console.log(`  ◆ ${repo} (manifest unreadable)`);
          console.log();
        }
      }

      // Save discovered repos
      const root = verseRoot();
      if (root) {
        const fed = loadFederationLinks(root);
        fed.discovered = repos.map(r => ({
          repo: r,
          discoveredAt: new Date().toISOString(),
        }));
        saveFederationLinks(root, fed);
      }
    } catch (err) {
      console.error(`  Error: ${err.message}`);
      console.error('  Make sure GitHub CLI is authenticated.\n');
    }
  },

  async link() {
    const repoUrl = args[1];
    const localNodeId = args[2];
    const remoteNodeId = args[3] || 'v1';

    if (!repoUrl || !localNodeId) {
      console.error('Usage: verse-federation link <owner/repo> <local-node-id> [remote-node-id]');
      process.exit(1);
    }

    const root = verseRoot();
    if (!root) { console.error('Not inside a verse repo.'); process.exit(1); }

    // Validate local node exists
    const localNodes = readdirSync(join(root, VERSE_DIR, 'nodes'))
      .filter(f => f.endsWith('.json'))
      .map(f => JSON.parse(readFileSync(join(root, VERSE_DIR, 'nodes', f), 'utf-8')));
    const localNode = localNodes.find(n => n.id === localNodeId);

    if (!localNode) {
      console.error(`Local node "${localNodeId}" not found.`);
      process.exit(1);
    }

    // Fetch remote manifest
    console.log(`\n  ◆ FEDERATION — Linking ${repoUrl}:${remoteNodeId} → ${localNodeId}\n`);

    try {
      const remoteManifest = execSync(
        `gh api "repos/${repoUrl}/contents/.verse/manifest.json" --jq ".content" | base64 -d`,
        { encoding: 'utf-8', timeout: 10000 }
      );
      const manifest = JSON.parse(remoteManifest);

      // Fetch remote node
      const remoteNodeRaw = execSync(
        `gh api "repos/${repoUrl}/contents/.verse/nodes/${remoteNodeId}.json" --jq ".content" | base64 -d`,
        { encoding: 'utf-8', timeout: 10000 }
      );
      const remoteNode = JSON.parse(remoteNodeRaw);

      // Save federation link
      const fed = loadFederationLinks(root);
      const link = {
        id: `fed-${Date.now()}`,
        localNodeId,
        remoteRepo: repoUrl,
        remoteNodeId,
        remoteLabel: remoteNode.label,
        remoteType: remoteNode.type,
        remoteName: manifest.name,
        linkedAt: new Date().toISOString(),
        relation: 'references',
      };

      fed.links.push(link);
      saveFederationLinks(root, fed);

      // Write RDF link
      const rdfDir = join(root, VERSE_DIR, 'rdf');
      const rdfFile = join(rdfDir, `${localNodeId}-federation.ttl`);
      const rdf = `@prefix verse: <https://ns.foxximediums.com/verse#> .

<${localNodeId}> verse:references <https://github.com/${repoUrl}/.verse/nodes/${remoteNodeId}> .
<https://github.com/${repoUrl}/.verse/nodes/${remoteNodeId}> a verse:${remoteNode.type} ;
    rdfs:label "${remoteNode.label}"@en ;
    verse:repository <https://github.com/${repoUrl}> .
`;
      writeFileSync(rdfFile, rdf);

      // Save remote node snapshot locally
      const fedDir = ensureFederationDir(root);
      const remoteDir = join(fedDir, 'remotes', repoUrl.replace('/', '__'));
      mkdirSync(remoteDir, { recursive: true });
      writeFileSync(join(remoteDir, `${remoteNodeId}.json`), JSON.stringify(remoteNode, null, 2));

      // Also fetch and save remote content if available
      try {
        const remoteContent = execSync(
          `gh api "repos/${repoUrl}/contents/.verse/content/${remoteNodeId}.md" --jq ".content" | base64 -d`,
          { encoding: 'utf-8', timeout: 10000 }
        );
        writeFileSync(join(remoteDir, `${remoteNodeId}.md`), remoteContent);
      } catch {
        // Content might not exist
      }

      console.log(`  Linked!`);
      console.log(`  Local:  ${localNodeId} (${localNode.label})`);
      console.log(`  Remote: ${repoUrl}:${remoteNodeId} (${remoteNode.label})`);
      console.log(`  Type:   ${remoteNode.type} from "${manifest.name}"`);
      console.log(`  RDF:    ${rdfFile}`);
      console.log();
      console.log(`  To merge this into your world:`);
      console.log(`  verse merge "Crossover" ${localNodeId} fed:${remoteNodeId}\n`);
    } catch (err) {
      console.error(`  Error: ${err.message}\n`);
    }
  },

  async pull() {
    const repoUrl = args[1];
    if (!repoUrl) {
      console.error('Usage: verse-federation pull <owner/repo>');
      process.exit(1);
    }

    const root = verseRoot();
    if (!root) { console.error('Not inside a verse repo.'); process.exit(1); }

    console.log(`\n  ◆ FEDERATION — Pulling verse data from ${repoUrl}\n`);

    try {
      // Fetch all node files
      const filesRaw = execSync(
        `gh api "repos/${repoUrl}/contents/.verse/nodes" --jq ".[].name"`,
        { encoding: 'utf-8', timeout: 15000 }
      ).trim();
      const files = filesRaw.split('\n').filter(f => f.endsWith('.json'));

      const fedDir = ensureFederationDir(root);
      const remoteDir = join(fedDir, 'remotes', repoUrl.replace('/', '__'));
      mkdirSync(remoteDir, { recursive: true });

      let count = 0;
      for (const file of files) {
        try {
          const nodeRaw = execSync(
            `gh api "repos/${repoUrl}/contents/.verse/nodes/${file}" --jq ".content" | base64 -d`,
            { encoding: 'utf-8', timeout: 10000 }
          );
          writeFileSync(join(remoteDir, file), nodeRaw);
          const node = JSON.parse(nodeRaw);

          // Try to get content too
          try {
            const contentRaw = execSync(
              `gh api "repos/${repoUrl}/contents/.verse/content/${file.replace('.json', '.md')}" --jq ".content" | base64 -d`,
              { encoding: 'utf-8', timeout: 10000 }
            );
            writeFileSync(join(remoteDir, file.replace('.json', '.md')), contentRaw);
          } catch {
            // Content optional
          }

          console.log(`  ↓ ${node.id}: ${node.label} (${node.type})`);
          count++;
        } catch {
          console.log(`  ✗ ${file} (failed)`);
        }
      }

      console.log(`\n  Pulled ${count} nodes from ${repoUrl}`);
      console.log(`  Saved to: ${VERSE_DIR}/${FEDERATION_DIR}/remotes/${repoUrl.replace('/', '__')}/`);
      console.log(`\n  To link a remote node: verse-federation link ${repoUrl} <local-id> <remote-id>\n`);
    } catch (err) {
      console.error(`  Error: ${err.message}\n`);
    }
  },

  status() {
    const root = verseRoot();
    if (!root) { console.error('Not inside a verse repo.'); process.exit(1); }

    const fed = loadFederationLinks(root);

    console.log(`\n  ◆ FEDERATION STATUS\n`);

    if (fed.links.length === 0 && fed.discovered.length === 0) {
      console.log('  No federation links or discoveries yet.');
      console.log('  Try: verse-federation discover <github-username>\n');
      return;
    }

    if (fed.discovered.length > 0) {
      console.log(`  Discovered Repos (${fed.discovered.length}):`);
      for (const d of fed.discovered) {
        console.log(`    ◆ ${d.repo}`);
      }
      console.log();
    }

    if (fed.links.length > 0) {
      console.log(`  Active Links (${fed.links.length}):`);
      for (const link of fed.links) {
        console.log(`    ${link.localNodeId} ←→ ${link.remoteRepo}:${link.remoteNodeId} (${link.remoteLabel})`);
        console.log(`      ${link.relation} · linked ${link.linkedAt}`);
      }
      console.log();
    }
  },

  help() {
    console.log(`
  ◆ VERSE FEDERATION CLI

  Commands:
    discover <github-user>                    Find verse repos by a user
    link <owner/repo> <local-id> [remote-id]  Link a remote verse to a local node
    pull <owner/repo>                         Download all nodes from a remote repo
    status                                    Show federation links

  Examples:
    verse-federation discover markjspivey-xwisee
    verse-federation link alice/thornveil v1 v1
    verse-federation pull alice/thornveil
    verse-federation status
`);
  },
};

const handler = commands[cmd];
if (!handler) {
  if (cmd) console.error(`Unknown command: ${cmd}`);
  commands.help();
} else {
  handler();
}
