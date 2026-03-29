/**
 * Auto-generated from .verse/ data — do not edit manually.
 * Generated at: 2026-03-29T18:27:39.933Z
 * Nodes: 19
 * Authors: 2
 */

export const AUTHORS = {
  "markj": {
    "name": "markj",
    "color": "#ff6b35",
    "eth": "—"
  },
  "markjspivey-xwisee": {
    "name": "verse-bot-test",
    "color": "#00d4aa",
    "eth": "—"
  }
};

export const SEED_NODES = [
  {
    "id": "v1",
    "type": "World",
    "label": "Ashenmere",
    "author": "markj",
    "depth": 0,
    "epoch": 1,
    "desc": "Root world for Ashenmere."
  },
  {
    "id": "v2",
    "type": "System",
    "label": "Pyro-Linguistics",
    "author": "markj",
    "depth": 1,
    "epoch": 1,
    "desc": "Extension of Ashenmere.",
    "parents": [
      "v1"
    ],
    "relation": "extends"
  },
  {
    "id": "v3",
    "type": "Character",
    "label": "The Archivist",
    "author": "markj",
    "depth": 1,
    "epoch": 2,
    "desc": "Extension of Ashenmere.",
    "parents": [
      "v1"
    ],
    "relation": "extends"
  },
  {
    "id": "v4",
    "type": "Location",
    "label": "The Cinder Library",
    "author": "markj",
    "depth": 1,
    "epoch": 3,
    "desc": "Extension of Ashenmere.",
    "parents": [
      "v1"
    ],
    "relation": "extends"
  },
  {
    "id": "v5",
    "type": "Artifact",
    "label": "Flame Grammar",
    "author": "markj",
    "depth": 2,
    "epoch": 4,
    "desc": "Extension of Pyro-Linguistics.",
    "parents": [
      "v2"
    ],
    "relation": "extends"
  },
  {
    "id": "v6",
    "type": "Verse",
    "label": "The First Burning",
    "author": "markj",
    "depth": 2,
    "epoch": 5,
    "desc": "Merge of v2, v3.",
    "parents": [
      "v2",
      "v3"
    ],
    "relation": "merges"
  },
  {
    "id": "v7",
    "type": "Verse",
    "label": "Resurrection Syntax",
    "author": "markj",
    "depth": 3,
    "epoch": 6,
    "desc": "Extension of The First Burning.",
    "parents": [
      "v6"
    ],
    "relation": "extends"
  },
  {
    "id": "v8",
    "type": "World",
    "label": "Glassdeep",
    "author": "markj",
    "depth": 1,
    "epoch": 7,
    "desc": "Fork of Ashenmere.",
    "parents": [
      "v1"
    ],
    "relation": "forks"
  },
  {
    "id": "v9",
    "type": "System",
    "label": "Crystalline Memory",
    "author": "markj",
    "depth": 2,
    "epoch": 8,
    "desc": "Extension of Glassdeep.",
    "parents": [
      "v8"
    ],
    "relation": "extends"
  },
  {
    "id": "v10",
    "type": "Faction",
    "label": "The Depth Singers",
    "author": "markj",
    "depth": 2,
    "epoch": 9,
    "desc": "Extension of Glassdeep.",
    "parents": [
      "v8"
    ],
    "relation": "extends"
  },
  {
    "id": "v11",
    "type": "Verse",
    "label": "Ash on Glass",
    "author": "markj",
    "depth": 3,
    "epoch": 10,
    "desc": "Merge of v2, v9.",
    "parents": [
      "v2",
      "v9"
    ],
    "relation": "merges"
  },
  {
    "id": "v12",
    "type": "Character",
    "label": "The Glassburner",
    "author": "markj",
    "depth": 4,
    "epoch": 11,
    "desc": "Extension of Ash on Glass.",
    "parents": [
      "v11"
    ],
    "relation": "extends"
  },
  {
    "id": "v13",
    "type": "Event",
    "label": "The Semiotic Fracture",
    "author": "markj",
    "depth": 4,
    "epoch": 12,
    "desc": "Fork of Ash on Glass.",
    "parents": [
      "v11"
    ],
    "relation": "forks"
  },
  {
    "id": "v14",
    "type": "Faction",
    "label": "Order of Cinders",
    "author": "markj",
    "depth": 3,
    "epoch": 13,
    "desc": "Extension of The First Burning.",
    "parents": [
      "v6"
    ],
    "relation": "extends"
  },
  {
    "id": "v15",
    "type": "Verse",
    "label": "The Deep Catalog",
    "author": "markj",
    "depth": 5,
    "epoch": 14,
    "desc": "Merge of v4, v9, v12.",
    "parents": [
      "v4",
      "v9",
      "v12"
    ],
    "relation": "merges"
  },
  {
    "id": "v16",
    "type": "Verse",
    "label": "Silent Flame",
    "author": "markj",
    "depth": 5,
    "epoch": 15,
    "desc": "Merge of v13, v14.",
    "parents": [
      "v13",
      "v14"
    ],
    "relation": "merges"
  },
  {
    "id": "v17",
    "type": "Artifact",
    "label": "The Unburnable Word",
    "author": "markj",
    "depth": 6,
    "epoch": 16,
    "desc": "Extension of The Deep Catalog.",
    "parents": [
      "v15"
    ],
    "relation": "extends"
  },
  {
    "id": "v18",
    "type": "Verse",
    "label": "Ashenmere Reforged",
    "author": "markj",
    "depth": 7,
    "epoch": 17,
    "desc": "Merge of v16, v17, v7.",
    "parents": [
      "v16",
      "v17",
      "v7"
    ],
    "relation": "merges"
  },
  {
    "id": "v19",
    "type": "Faction",
    "label": "The Ash Weavers",
    "author": "markjspivey-xwisee",
    "depth": 2,
    "epoch": 18,
    "desc": "A secret guild that operates within the Cinder Library. While the Archivist reads ash, the Weavers reassemble it — literally weaving burned fragments into new texts that never existed. They believe all possible books already exist as potential patterns in ash, and their role is to find and reconstruct them. Controversial within Ashenmere because their \"found texts\" sometimes contradict established pyro-linguistic grammar.",
    "parents": [
      "v4"
    ],
    "relation": "extends"
  }
];
