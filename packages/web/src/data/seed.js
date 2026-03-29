/**
 * Seed data — the Ashenmere × Glassdeep sample multiverse.
 * Demonstrates every relation type, cross-world composition,
 * agent authorship, and how scoring rewards connective creativity.
 */

export const AUTHORS = {
  a1: { name: 'Kael', color: '#ff6b35', eth: '0x1a2b...3c4d' },
  a2: { name: 'Lyra', color: '#00d4aa', eth: '0x5e6f...7g8h' },
  a3: { name: 'Thorne', color: '#7b68ee', eth: '0x9i0j...1k2l' },
  a4: { name: 'Sable', color: '#ff4081', eth: '0x3m4n...5o6p' },
  a5: { name: 'Agent:Claude', color: '#c8b6ff', eth: '—', isAgent: true, director: 'a1' },
};

export const SEED_NODES = [
  {
    id: 'v1', type: 'World', label: 'Ashenmere', author: 'a1',
    depth: 0, epoch: 1,
    desc: 'A world where fire is memory and ash is language. The first System: pyro-linguistics.',
  },
  {
    id: 'v2', type: 'System', label: 'Pyro-Linguistics', author: 'a1',
    depth: 1, epoch: 1, parents: ['v1'], relation: 'extends',
    desc: 'Magic system where burning materials produces semantic meaning. Grammar encoded in flame color.',
  },
  {
    id: 'v3', type: 'Character', label: 'The Archivist', author: 'a2',
    depth: 1, epoch: 2, parents: ['v1'], relation: 'extends',
    desc: 'A mute librarian who reads the ash of burned books. First character to inhabit Ashenmere.',
  },
  {
    id: 'v4', type: 'Location', label: 'The Cinder Library', author: 'a2',
    depth: 2, epoch: 2, parents: ['v1', 'v3'], relation: 'extends',
    desc: 'A library where books are burned to be read. The ash patterns on the walls are the catalog.',
  },
  {
    id: 'v5', type: 'Verse', label: 'The First Burning', author: 'a1',
    depth: 2, epoch: 3, parents: ['v2', 'v3'], relation: 'merges',
    desc: 'The Archivist discovers that Pyro-Linguistics can resurrect destroyed texts. Merge of System + Character.',
  },
  {
    id: 'v6', type: 'World', label: 'Glassdeep', author: 'a3',
    depth: 0, epoch: 3,
    desc: 'An ocean world where water solidifies into crystal at depth. Separate universe, independent creation.',
  },
  {
    id: 'v7', type: 'System', label: 'Crystalline Memory', author: 'a3',
    depth: 1, epoch: 4, parents: ['v6'], relation: 'extends',
    desc: 'Water remembers. Deep-crystal formations are compressed memories of ancient seas.',
  },
  {
    id: 'v8', type: 'Verse', label: 'Ash on Glass', author: 'a4',
    depth: 3, epoch: 5, parents: ['v2', 'v7'], relation: 'merges',
    desc: 'A crossover: Pyro-Linguistics meets Crystalline Memory. Fire-words frozen in deep crystal.',
  },
  {
    id: 'v9', type: 'Character', label: 'The Glassburner', author: 'a4',
    depth: 4, epoch: 5, parents: ['v8', 'v3'], relation: 'extends',
    desc: "Born from the merge — speaks fire into crystal. Redefines The Archivist's role.",
  },
  {
    id: 'v10', type: 'Event', label: 'The Semiotic Fracture', author: 'a3',
    depth: 4, epoch: 6, parents: ['v8'], relation: 'forks',
    desc: 'What if the merge went wrong? Crystal shatters meaning instead of preserving it. Fork of Ash on Glass.',
  },
  {
    id: 'v11', type: 'Verse', label: 'Ember Cartography', author: 'a5',
    depth: 3, epoch: 6, parents: ['v2', 'v4'], relation: 'extends',
    desc: 'Agent-authored: maps of Ashenmere drawn in controlled burns. Directed by Kael.',
  },
  {
    id: 'v12', type: 'Verse', label: 'The Deep Catalog', author: 'a2',
    depth: 5, epoch: 7, parents: ['v4', 'v7', 'v9'], relation: 'merges',
    desc: 'Lyra synthesizes three threads — Library + Crystal Memory + Glassburner. High merge centrality.',
  },
  {
    id: 'v13', type: 'Faction', label: 'Order of Cinders', author: 'a1',
    depth: 3, epoch: 7, parents: ['v5', 'v2'], relation: 'extends',
    desc: 'A faction of pyro-linguists who guard the grammar of flame. Political layer.',
  },
  {
    id: 'v14', type: 'Verse', label: 'Silent Flame', author: 'a4',
    depth: 5, epoch: 8, parents: ['v10', 'v13'], relation: 'merges',
    desc: 'The Fracture meets the Order. What happens when the guardians face meaningless fire?',
  },
  {
    id: 'v15', type: 'World', label: 'Ashenmere Reforged', author: 'a2',
    depth: 6, epoch: 8, parents: ['v12', 'v14'], relation: 'redefines',
    desc: 'Lyra redefines the entire world. Ash is no longer language — it is silence. Interpretant shift.',
  },
];
