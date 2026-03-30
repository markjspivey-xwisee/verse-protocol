/**
 * Verse Protocol — Schema Constants & Narrative Object Types
 *
 * Mirrors the verse: RDF namespace from the ontology.
 */

export const NAMESPACE = 'https://ns.foxximediums.com/verse#';

export const NARRATIVE_TYPES = [
  'World',
  'Verse',
  'Character',
  'Location',
  'System',
  'Event',
  'Artifact',
  'Faction',
  'Timeline',
];

export const RELATION_TYPES = [
  'extends',
  'forks',
  'merges',
  'redefines',
  'translates',
  'references',
  'reuses',
];

export const TYPE_ICONS = {
  World: '◆',
  Verse: '◇',
  Character: '☉',
  Location: '◈',
  System: '⚙',
  Event: '⚡',
  Artifact: '✦',
  Faction: '⛊',
  Timeline: '↦',
};

export const RELATION_COLORS = {
  extends: '#4ade80',
  forks: '#f59e0b',
  merges: '#818cf8',
  redefines: '#f43f5e',
  references: '#94a3b8',
  translates: '#06b6d4',
  reuses: '#a78bfa',
};

export const ATTESTATION_TYPES = [
  'authorship',
  'influence_snapshot',
  'license_grant',
  'merge_ratification',
];

export const AFFORDANCE_TYPES = [
  'open_plotline',
  'unexplored_region',
  'undefined_system',
  'character_vacancy',
  'timeline_branch',
  'crossover_opportunity',
];

/**
 * Generate a minimal RDF context declaration for a narrative object.
 */
export function generateContextRDF(obj) {
  const id = obj.id || `verse:${obj.label?.replace(/\s+/g, '')}`;
  const type = obj.type || 'Verse';
  function escapeRdf(s) { return (s || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"'); }

  const lines = [
    `@prefix verse: <${NAMESPACE}> .`,
    `@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .`,
    `@prefix dcterms: <http://purl.org/dc/terms/> .`,
    `@prefix prov: <http://www.w3.org/ns/prov#> .`,
    ``,
    `<${id}> a verse:${type} ;`,
    `    rdfs:label "${escapeRdf(obj.label || 'Untitled')}"@en ;`,
  ];

  if (obj.description) {
    lines.push(`    rdfs:comment """${escapeRdf(obj.description)}"""@en ;`);
  }

  if (obj.author) {
    lines.push(`    verse:authoredBy <${obj.author}> ;`);
  }

  if (obj.parents?.length) {
    for (const parent of obj.parents) {
      const rel = obj.relation || 'extends';
      lines.push(`    verse:${rel} <${parent}> ;`);
    }
  }

  // Close the last statement
  const last = lines.length - 1;
  lines[last] = lines[last].replace(/ ;$/, ' .');

  return lines.join('\n');
}
