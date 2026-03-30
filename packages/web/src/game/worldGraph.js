/**
 * World Graph — transforms the verse DAG into a navigable game world.
 *
 * Nodes are rooms. Edges are doors. Type determines what you find there.
 */

const CONTAINMENT_TYPES = {
  World: ['Location', 'System', 'Character', 'Artifact', 'Faction', 'Verse', 'Event', 'Timeline'],
  Location: ['Character', 'Artifact', 'Faction', 'Verse', 'Event'],
  Faction: ['Character', 'Verse', 'Event'],
  Verse: ['Character', 'Artifact', 'Event'],
  Event: ['Artifact', 'Character', 'Verse'],
};

// Types that are "rooms" you can stand in vs "entities" you interact with at a room
const ROOM_TYPES = new Set(['World', 'Location', 'Verse', 'Event', 'Timeline']);
const ENTITY_TYPES = new Set(['Character', 'Artifact', 'System', 'Faction']);

/**
 * Build a navigable world graph from flat seed nodes.
 */
export function buildWorldGraph(nodes) {
  const byId = Object.fromEntries(nodes.map(n => [n.id, n]));
  const childMap = {};

  // Build child map
  for (const n of nodes) {
    childMap[n.id] = [];
  }
  for (const n of nodes) {
    if (n.parents) {
      for (const pid of n.parents) {
        if (childMap[pid]) childMap[pid].push(n.id);
      }
    }
  }

  const graph = {};

  for (const n of nodes) {
    const children = childMap[n.id] || [];

    // Entities at this location (non-room children)
    const entities = children.filter(cid => ENTITY_TYPES.has(byId[cid]?.type));

    // Navigable rooms from here (room-type children)
    const rooms = children.filter(cid => ROOM_TYPES.has(byId[cid]?.type));

    // Siblings (other children of same parent, excluding self)
    const siblings = [];
    if (n.parents) {
      for (const pid of n.parents) {
        for (const sib of (childMap[pid] || [])) {
          if (sib !== n.id && ROOM_TYPES.has(byId[sib]?.type) && !siblings.includes(sib)) {
            siblings.push(sib);
          }
        }
      }
    }

    // Portals: fork/merge edges that cross between different world-roots
    const portals = [];
    if (n.relation === 'forks' || n.relation === 'merges') {
      if (n.parents) {
        for (const pid of n.parents) {
          if (!portals.includes(pid)) portals.push(pid);
        }
      }
    }
    // Also check if any child is a fork/merge coming FROM a different subtree
    for (const cid of children) {
      const child = byId[cid];
      if (child && (child.relation === 'forks' || child.relation === 'merges')) {
        if (!portals.includes(cid)) portals.push(cid);
      }
    }

    graph[n.id] = {
      node: n,
      entities,
      rooms,
      siblings,
      portals,
      parentIds: n.parents || [],
    };
  }

  return graph;
}

/**
 * Detect narrative affordances — expansion points where the world invites creation.
 */
export function detectAffordances(nodes) {
  const byId = Object.fromEntries(nodes.map(n => [n.id, n]));
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

  // Track which nodes have been forked
  const forkedNodes = new Set();
  for (const n of nodes) {
    if (n.relation === 'forks' && n.parents) {
      for (const pid of n.parents) forkedNodes.add(pid);
    }
  }

  // Find world roots (nodes with no parents or type=World)
  const worldRoots = nodes.filter(n => n.type === 'World');
  const worldSubtrees = {};
  function findRoot(id, visited = new Set()) {
    if (visited.has(id)) return null;
    visited.add(id);
    const node = byId[id];
    if (!node) return null;
    if (node.type === 'World' && (!node.parents || node.parents.length === 0)) return id;
    if (node.parents) {
      for (const pid of node.parents) {
        const root = findRoot(pid, visited);
        if (root) return root;
      }
    }
    return null;
  }

  // Check for cross-world merges
  const mergeLinks = new Set();
  for (const n of nodes) {
    if (n.relation === 'merges' && n.parents?.length >= 2) {
      const roots = n.parents.map(pid => findRoot(pid)).filter(Boolean);
      const uniqueRoots = [...new Set(roots)];
      if (uniqueRoots.length >= 2) {
        for (const r of uniqueRoots) mergeLinks.add(r);
      }
    }
  }

  const affordances = {};

  for (const n of nodes) {
    const affs = [];
    const childTypes = childTypeMap[n.id];

    // Unexplored region: World or Location with no child Locations
    if ((n.type === 'World' || n.type === 'Location') && !childTypes.has('Location')) {
      affs.push({
        type: 'unexplored_region',
        label: 'Unexplored Region',
        desc: `No locations have been discovered within ${n.label} yet.`,
        suggestedType: 'Location',
        suggestedRelation: 'extends',
      });
    }

    // Character vacancy: Location or Faction with no Characters
    if ((n.type === 'Location' || n.type === 'Faction') && !childTypes.has('Character')) {
      affs.push({
        type: 'character_vacancy',
        label: 'Character Vacancy',
        desc: `No characters inhabit ${n.label}.`,
        suggestedType: 'Character',
        suggestedRelation: 'extends',
      });
    }

    // Undefined system: World with no System
    if (n.type === 'World' && !childTypes.has('System')) {
      affs.push({
        type: 'undefined_system',
        label: 'Undefined System',
        desc: `${n.label} has no defined rule system or magic system.`,
        suggestedType: 'System',
        suggestedRelation: 'extends',
      });
    }

    // Open plotline: Character or Event with no child Verse/Event
    if ((n.type === 'Character' || n.type === 'Event') && !childTypes.has('Verse') && !childTypes.has('Event')) {
      affs.push({
        type: 'open_plotline',
        label: 'Open Plotline',
        desc: `${n.label}'s story has no continuation.`,
        suggestedType: 'Verse',
        suggestedRelation: 'extends',
      });
    }

    // Timeline branch: any node never forked
    if (!forkedNodes.has(n.id) && ROOM_TYPES.has(n.type)) {
      affs.push({
        type: 'timeline_branch',
        label: 'Timeline Branch',
        desc: `What if ${n.label} went differently?`,
        suggestedType: n.type,
        suggestedRelation: 'forks',
      });
    }

    if (affs.length > 0) {
      affordances[n.id] = affs;
    }
  }

  // Crossover opportunity: World roots with no merge between them
  if (worldRoots.length >= 2) {
    for (let i = 0; i < worldRoots.length; i++) {
      for (let j = i + 1; j < worldRoots.length; j++) {
        // Check if any merge connects these two subtrees
        // (simplified: just check if both are in mergeLinks)
        if (!mergeLinks.has(worldRoots[i].id) || !mergeLinks.has(worldRoots[j].id)) {
          const aff = {
            type: 'crossover_opportunity',
            label: 'Crossover Opportunity',
            desc: `${worldRoots[i].label} and ${worldRoots[j].label} could be connected.`,
            suggestedType: 'Verse',
            suggestedRelation: 'merges',
            mergeTargets: [worldRoots[i].id, worldRoots[j].id],
          };
          if (!affordances[worldRoots[i].id]) affordances[worldRoots[i].id] = [];
          affordances[worldRoots[i].id].push(aff);
        }
      }
    }
  }

  return affordances;
}

export { ROOM_TYPES, ENTITY_TYPES };
