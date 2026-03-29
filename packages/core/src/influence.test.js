import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { computeInfluence, computeAuthorStats, buildMerkleRoot } from './influence.js';

const SAMPLE_NODES = [
  { id: 'v1', type: 'World', label: 'Root', author: 'a1', depth: 0, epoch: 1 },
  { id: 'v2', type: 'System', label: 'System A', author: 'a1', depth: 1, epoch: 1, parents: ['v1'], relation: 'extends' },
  { id: 'v3', type: 'Character', label: 'Char B', author: 'a2', depth: 1, epoch: 2, parents: ['v1'], relation: 'extends' },
  { id: 'v4', type: 'Verse', label: 'Merge AB', author: 'a2', depth: 2, epoch: 3, parents: ['v2', 'v3'], relation: 'merges' },
  { id: 'v5', type: 'World', label: 'Fork', author: 'a3', depth: 2, epoch: 3, parents: ['v1'], relation: 'forks' },
  { id: 'v6', type: 'Verse', label: 'Redefine', author: 'a3', depth: 3, epoch: 4, parents: ['v4'], relation: 'redefines' },
];

const AUTHORS = {
  a1: { name: 'Alice', color: '#ff0000' },
  a2: { name: 'Bob', color: '#00ff00' },
  a3: { name: 'Carol', color: '#0000ff' },
};

describe('computeInfluence', () => {
  it('returns scores for all nodes', () => {
    const scores = computeInfluence(SAMPLE_NODES);
    assert.strictEqual(Object.keys(scores).length, SAMPLE_NODES.length);
    for (const node of SAMPLE_NODES) {
      assert.ok(scores[node.id], `Missing score for ${node.id}`);
      assert.strictEqual(typeof scores[node.id].total, 'number');
      assert.strictEqual(typeof scores[node.id].normalized, 'number');
    }
  });

  it('root node has highest fork depth', () => {
    const scores = computeInfluence(SAMPLE_NODES);
    const rootDepth = scores['v1'].forkDepth;
    for (const [id, s] of Object.entries(scores)) {
      if (id !== 'v1') {
        assert.ok(rootDepth >= s.forkDepth, `v1 depth ${rootDepth} should >= ${id} depth ${s.forkDepth}`);
      }
    }
  });

  it('root node has highest reuse count', () => {
    const scores = computeInfluence(SAMPLE_NODES);
    const rootReuse = scores['v1'].reuseCount;
    for (const [id, s] of Object.entries(scores)) {
      if (id !== 'v1') {
        assert.ok(rootReuse >= s.reuseCount);
      }
    }
  });

  it('merge parents get merge centrality > 0', () => {
    const scores = computeInfluence(SAMPLE_NODES);
    assert.ok(scores['v2'].mergeCentrality > 0);
    assert.ok(scores['v3'].mergeCentrality > 0);
  });

  it('redefines gets highest novelty delta', () => {
    const scores = computeInfluence(SAMPLE_NODES);
    assert.ok(scores['v6'].noveltyDelta > 0);
    assert.ok(scores['v6'].noveltyDelta > scores['v5'].noveltyDelta);
  });

  it('normalized scores are in [0, 1]', () => {
    const scores = computeInfluence(SAMPLE_NODES);
    for (const s of Object.values(scores)) {
      assert.ok(s.normalized >= 0 && s.normalized <= 1);
    }
  });

  it('leaf nodes have fork depth 0', () => {
    const scores = computeInfluence(SAMPLE_NODES);
    assert.strictEqual(scores['v5'].forkDepth, 0);
    assert.strictEqual(scores['v6'].forkDepth, 0);
  });

  it('handles single node', () => {
    const scores = computeInfluence([{ id: 'solo', type: 'World', label: 'Solo' }]);
    assert.strictEqual(scores['solo'].total, 0);
  });

  it('handles empty array', () => {
    const scores = computeInfluence([]);
    assert.strictEqual(Object.keys(scores).length, 0);
  });
});

describe('computeAuthorStats', () => {
  it('computes per-author aggregates sorted by score', () => {
    const scores = computeInfluence(SAMPLE_NODES);
    const stats = computeAuthorStats(SAMPLE_NODES, AUTHORS, scores);
    assert.strictEqual(stats.length, 3);
    for (let i = 1; i < stats.length; i++) {
      assert.ok(stats[i - 1].totalScore >= stats[i].totalScore);
    }
  });

  it('counts verses and merges correctly', () => {
    const scores = computeInfluence(SAMPLE_NODES);
    const stats = computeAuthorStats(SAMPLE_NODES, AUTHORS, scores);
    const bob = stats.find(s => s.name === 'Bob');
    assert.strictEqual(bob.count, 2);
    assert.strictEqual(bob.merges, 1);
  });
});

describe('buildMerkleRoot', () => {
  it('returns a 64-char hex string', async () => {
    const scores = computeInfluence(SAMPLE_NODES);
    const root = await buildMerkleRoot(scores);
    assert.strictEqual(root.length, 64);
    assert.ok(/^[0-9a-f]{64}$/.test(root));
  });

  it('is deterministic', async () => {
    const scores = computeInfluence(SAMPLE_NODES);
    const root1 = await buildMerkleRoot(scores);
    const root2 = await buildMerkleRoot(scores);
    assert.strictEqual(root1, root2);
  });

  it('changes when scores change', async () => {
    const scores1 = computeInfluence(SAMPLE_NODES);
    const scores2 = computeInfluence([...SAMPLE_NODES, {
      id: 'v7', type: 'Verse', label: 'New', author: 'a1', depth: 1, parents: ['v1'], relation: 'extends',
    }]);
    const root1 = await buildMerkleRoot(scores1);
    const root2 = await buildMerkleRoot(scores2);
    assert.notStrictEqual(root1, root2);
  });

  it('handles empty scores', async () => {
    const root = await buildMerkleRoot({});
    assert.strictEqual(root.length, 64);
  });
});
