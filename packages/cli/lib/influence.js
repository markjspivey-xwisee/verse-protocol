/**
 * Verse Protocol — Influence Scoring Engine (Proof of Creativity)
 *
 * Computes a PageRank-like recursive influence metric over the narrative DAG.
 *
 * Four components:
 *   - Fork Depth:         max depth of the descendant fork tree
 *   - Structural Reuse:   total downstream verse:reuses edges (transitive)
 *   - Merge Centrality:   fraction of merge commits including this object
 *   - Novelty Delta:      KL-divergence proxy weighted by downstream adoption
 *
 * Formula:
 *   I(v) = w_fd * ForkDepth(v)
 *        + w_ru * ReuseCount(v)
 *        + w_mc * MergeCentrality(v) * 10
 *        + w_nd * NoveltyDelta(v)
 */

const DEFAULT_WEIGHTS = {
  forkDepth: 0.25,
  reuseCount: 0.30,
  mergeCentrality: 0.25,
  noveltyDelta: 0.20,
};

const NOVELTY_MULTIPLIERS = {
  redefines: 1.5,
  merges: 0.8,
  forks: 0.6,
};

/**
 * Compute influence scores for every node in the DAG.
 *
 * @param {Array<Object>} nodes — array of { id, parents?: string[], relation?: string, ... }
 * @param {Object} [weights] — optional weight overrides
 * @returns {Object} — map of node id → InfluenceScore
 */
export function computeInfluence(nodes, weights = DEFAULT_WEIGHTS) {
  const scores = {};
  const childMap = {};
  const mergeMap = {};

  // Initialize
  for (const n of nodes) {
    scores[n.id] = {
      forkDepth: 0,
      reuseCount: 0,
      mergeCentrality: 0,
      noveltyDelta: 0,
      total: 0,
      normalized: 0,
    };
    childMap[n.id] = [];
    mergeMap[n.id] = 0;
  }

  // Build child map and merge participation counts
  for (const n of nodes) {
    if (n.parents) {
      for (const p of n.parents) {
        if (childMap[p]) childMap[p].push(n.id);
      }
      if (n.relation === 'merges' && n.parents.length > 1) {
        for (const p of n.parents) {
          mergeMap[p] = (mergeMap[p] || 0) + 1;
        }
      }
    }
  }

  // Recursive max descendant depth
  function maxDepth(id, visited = new Set()) {
    if (visited.has(id)) return 0;
    visited.add(id);
    const children = childMap[id] || [];
    if (children.length === 0) return 0;
    return 1 + Math.max(...children.map(c => maxDepth(c, new Set(visited))));
  }

  // Recursive transitive reuse count
  function reuseCount(id, visited = new Set()) {
    if (visited.has(id)) return 0;
    visited.add(id);
    const children = childMap[id] || [];
    return children.length + children.reduce((sum, c) => sum + reuseCount(c, new Set(visited)), 0);
  }

  const totalMerges = Object.values(mergeMap).reduce((s, v) => s + v, 0) || 1;

  // Score each node
  for (const n of nodes) {
    const s = scores[n.id];
    s.forkDepth = maxDepth(n.id);
    s.reuseCount = reuseCount(n.id);
    s.mergeCentrality = (mergeMap[n.id] || 0) / totalMerges;

    // Novelty delta: relation-type multiplier × parent fan-in
    const relationMult = NOVELTY_MULTIPLIERS[n.relation] || 0;
    const parentCount = (n.parents || []).length;
    s.noveltyDelta = relationMult * (1 + parentCount * 0.2);

    // Composite score
    s.total =
      weights.forkDepth * s.forkDepth +
      weights.reuseCount * s.reuseCount +
      weights.mergeCentrality * s.mergeCentrality * 10 +
      weights.noveltyDelta * s.noveltyDelta;
  }

  // Normalize to [0, 1]
  const maxTotal = Math.max(...Object.values(scores).map(s => s.total), 0.001);
  for (const s of Object.values(scores)) {
    s.normalized = s.total / maxTotal;
  }

  return scores;
}

/**
 * Compute per-author aggregate stats.
 */
export function computeAuthorStats(nodes, authors, scores) {
  const stats = {};
  for (const [aid, a] of Object.entries(authors)) {
    const authored = nodes.filter(n => n.author === aid);
    const totalScore = authored.reduce((s, n) => s + (scores[n.id]?.total || 0), 0);
    const merges = authored.filter(n => n.relation === 'merges').length;
    const redefines = authored.filter(n => n.relation === 'redefines').length;
    stats[aid] = { ...a, id: aid, count: authored.length, totalScore, merges, redefines };
  }
  return Object.values(stats).sort((a, b) => b.totalScore - a.totalScore);
}

/**
 * Build a Merkle root from influence scores (for on-chain anchoring).
 * Uses a simple binary Merkle tree with SHA-256.
 */
export async function buildMerkleRoot(scores) {
  const leaves = Object.entries(scores)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([id, s]) => `${id}:${s.total.toFixed(8)}`);

  if (typeof globalThis.crypto?.subtle !== 'undefined') {
    return computeMerkleTree(leaves, async (data) => {
      const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(data));
      return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
    });
  }

  // Node.js fallback
  const { createHash } = await import('crypto');
  return computeMerkleTree(leaves, async (data) => {
    return createHash('sha256').update(data).digest('hex');
  });
}

async function computeMerkleTree(leaves, hashFn) {
  if (leaves.length === 0) return '0'.repeat(64);
  let level = await Promise.all(leaves.map(l => hashFn(l)));
  while (level.length > 1) {
    const next = [];
    for (let i = 0; i < level.length; i += 2) {
      const left = level[i];
      const right = i + 1 < level.length ? level[i + 1] : left;
      next.push(await hashFn(left + right));
    }
    level = next;
  }
  return level[0];
}

export { DEFAULT_WEIGHTS, NOVELTY_MULTIPLIERS };
