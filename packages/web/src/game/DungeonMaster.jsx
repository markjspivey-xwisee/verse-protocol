import { useState, useRef, useEffect, useMemo } from 'react';

/**
 * AI Dungeon Master — knows the world's rules and responds accordingly.
 *
 * Uses the content files as a world bible. Parses systems (Pyro-Linguistics,
 * Crystalline Memory) for rule enforcement. Generates contextual responses
 * based on where the player is and what's around them.
 *
 * No external API — runs entirely on pre-computed response templates
 * derived from the lore. The "AI" is the world itself.
 */

const SYSTEM_RULES = {
  // Extracted from Pyro-Linguistics content
  'pyro-linguistics': {
    materials: {
      wood: { produces: 'narrative', tense: 'hardwood=past, softwood=present, green=future' },
      paper: { produces: 'argument', quality: 'thin=hypothetical, thick=axiomatic' },
      cloth: { produces: 'emotion', quality: 'silk=longing, burlap=rage, cotton=contentment' },
      metal: { produces: 'law', quality: 'immutable declarations, cannot be contradicted' },
      bone: { produces: 'identity', quality: 'names, definitions, essences of the dead' },
    },
    flameColors: {
      orange: 'declarative — stating facts',
      blue: 'interrogative — asking questions',
      white: 'imperative — issuing commands',
      green: 'subjunctive — wishes or hypotheticals',
      red: 'emphatic — intensifying meaning',
      black: 'negation — unsaying what was said',
    },
    rules: [
      'Fire speaks truth — it cannot produce fiction',
      'Ash is the written form of fire-speech',
      'A breeze can scatter a sentence, rain dissolves paragraphs',
      'Mute fire destroys without speaking — it is feared',
    ],
  },
  // Extracted from Crystalline Memory content
  'crystalline-memory': {
    encoding: {
      sensory: 'what the water felt, saw, tasted, heard at compression',
      temporal: 'when the memory formed, readable from growth rings',
      emotional: 'joy=hexagonal, grief=monoclinic, fear=amorphous glass',
    },
    reading: 'Sing at matching frequencies — crystal replays memories briefly',
    writing: 'Bring objects to solidification depth (~300m), let water compress',
    rules: [
      'Water remembers everything that passes through it',
      'Surface impressions are fleeting, deep ones permanent',
      'The deeper the crystal, the older the memory',
      'The Deep Archive is too dense for any living voice',
    ],
  },
};

function getWorldSystem(nodeId, nodes, content) {
  // Walk up the parent chain to find applicable systems
  const byId = Object.fromEntries(nodes.map(n => [n.id, n]));
  const systems = [];
  const visited = new Set();

  function walk(id) {
    if (visited.has(id)) return;
    visited.add(id);
    const node = byId[id];
    if (!node) return;
    if (node.type === 'System') {
      systems.push(node);
    }
    if (node.parents) {
      for (const pid of node.parents) walk(pid);
    }
  }
  walk(nodeId);

  // Also walk siblings
  const node = byId[nodeId];
  if (node?.parents) {
    for (const pid of node.parents) {
      const parent = byId[pid];
      if (parent) {
        for (const n of nodes) {
          if (n.parents?.includes(pid) && n.type === 'System') {
            if (!systems.find(s => s.id === n.id)) systems.push(n);
          }
        }
      }
    }
  }

  return systems;
}

// Action patterns the DM recognizes
const ACTION_PATTERNS = [
  { pattern: /burn|light|ignite|set fire/i, action: 'burn', system: 'pyro-linguistics' },
  { pattern: /read|examine|inspect|look at/i, action: 'examine' },
  { pattern: /sing|hum|resonate|vibrate/i, action: 'sing', system: 'crystalline-memory' },
  { pattern: /dive|descend|go deep/i, action: 'dive', system: 'crystalline-memory' },
  { pattern: /speak|say|tell|ask/i, action: 'speak' },
  { pattern: /touch|feel|pick up|take/i, action: 'touch' },
  { pattern: /listen|hear|silence/i, action: 'listen' },
  { pattern: /walk|go|move|travel|explore/i, action: 'move' },
];

const MATERIAL_PATTERN = /\b(wood|paper|cloth|silk|burlap|cotton|metal|iron|bone|book|letter|stone|crystal|glass|water|ash)\b/i;
const COLOR_PATTERN = /\b(orange|blue|white|green|red|black|violet|purple)\b/i;

function generateResponse(input, currentNode, nodes, content) {
  const lowered = input.toLowerCase();
  const node = currentNode;
  const nodeContent = content[node.id] || '';

  // Detect action
  let matched = ACTION_PATTERNS.find(p => p.pattern.test(lowered));
  let action = matched?.action || 'examine';
  let systemKey = matched?.system;

  // Detect material and color
  const materialMatch = lowered.match(MATERIAL_PATTERN);
  const colorMatch = lowered.match(COLOR_PATTERN);
  const material = materialMatch?.[1]?.toLowerCase();
  const color = colorMatch?.[1]?.toLowerCase();

  // Find applicable systems
  const systems = getWorldSystem(node.id, nodes, content);
  const hasPyro = systems.some(s => s.label.toLowerCase().includes('pyro'));
  const hasCrystal = systems.some(s => s.label.toLowerCase().includes('crystal'));

  // Build response based on action + context
  const responses = [];

  if (action === 'burn' && hasPyro) {
    const pyro = SYSTEM_RULES['pyro-linguistics'];
    if (material && pyro.materials[material]) {
      const m = pyro.materials[material];
      responses.push(`You set the ${material} alight. The flame produces ${m.produces}. ${m.tense || m.quality}`);
      if (color && pyro.flameColors[color]) {
        responses.push(`The flame burns ${color} — ${pyro.flameColors[color]}.`);
      } else {
        const defaultColor = 'orange';
        responses.push(`The flame burns ${defaultColor} — ${pyro.flameColors[defaultColor]}.`);
      }
      responses.push(`The ash settles on the nearest surface, forming readable text.`);
    } else if (material) {
      responses.push(`You attempt to burn the ${material}. The flame flickers uncertainly — this material's semantic properties are not well-understood in the current grammar.`);
      responses.push(`Perhaps an extension to the Flame Grammar is needed here.`);
    } else {
      responses.push(`You reach for flame, but what will you burn? In Ashenmere, the material determines the meaning. Wood speaks narrative, paper speaks argument, cloth speaks emotion, metal speaks law, bone speaks identity.`);
    }
  } else if (action === 'burn' && !hasPyro) {
    responses.push(`You try to burn something, but fire works differently here — or perhaps not at all. The rules of Pyro-Linguistics do not govern this place.`);
  } else if (action === 'sing' && hasCrystal) {
    const crystal = SYSTEM_RULES['crystalline-memory'];
    responses.push(`You open your throat and let sound descend into the deep. The crystal around you begins to resonate.`);
    if (node.type === 'Location' || node.type === 'World') {
      responses.push(`Memories surface in the vibrating water: fragments of sensation, compressed emotions, the ghostly echo of events long past. ${crystal.encoding.emotional}`);
    }
    responses.push(`The crystal's response fades. The memory sinks back into permanence.`);
  } else if (action === 'sing' && !hasCrystal) {
    responses.push(`Your song echoes but finds nothing to resonate with. This place does not store memories in crystal.`);
  } else if (action === 'dive' && hasCrystal) {
    responses.push(`You descend. The water thickens around you as pressure mounts. At this depth, you can feel the boundary where fluid becomes solid — where the ocean begins to remember.`);
    responses.push(`The crystal formations here are ${node.depth < 3 ? 'young and transparent, their memories shallow and recent' : 'ancient and dense, encoding experiences from before any voice sang to them'}.`);
  } else if (action === 'examine') {
    if (nodeContent) {
      // Extract a relevant passage from the content
      const paragraphs = nodeContent.split('\n\n').filter(p => p.trim() && !p.startsWith('#') && !p.startsWith('**Type'));
      const relevant = paragraphs[Math.min(1, paragraphs.length - 1)] || paragraphs[0] || node.desc;
      responses.push(`You look closer at ${node.label}.`);
      responses.push(relevant?.trim() || node.desc);
    } else {
      responses.push(`You examine ${node.label}. ${node.desc}`);
    }
  } else if (action === 'listen') {
    if (hasPyro) {
      responses.push(`You listen. Beneath the surface noise, you can hear it — the faint crackle of residual fire-speech, echoes of conversations burned long ago. The ash on the walls still hums with meaning, though the words have settled into patterns only the patient can read.`);
    } else if (hasCrystal) {
      responses.push(`You listen. The deep crystal produces a subsonic hum — not sound exactly, but the memory of sound, compressed into vibration. If you had the training of a Depth Singer, you could read the frequencies. Instead, you feel them in your bones.`);
    } else {
      responses.push(`You listen to the silence of ${node.label}. The silence has texture here.`);
    }
  } else if (action === 'move') {
    responses.push(`You look for paths forward from ${node.label}. Use the navigation cards below to explore.`);
  } else if (action === 'speak') {
    if (hasPyro) {
      responses.push(`In Ashenmere, speaking through air is considered crude — a waste of breath that could fuel a flame. True communication happens through fire. To speak with meaning here, you must burn.`);
    } else {
      responses.push(`Your words hang in the air of ${node.label}. Whether anyone — or anything — hears them remains to be seen.`);
    }
  } else if (action === 'touch') {
    if (material === 'ash' && hasPyro) {
      responses.push(`You press your fingers into the ash. Like the Archivist, you try to feel the residue of meaning. The ash is cool and fine. You sense... something. A vibration too old for language, a memory encoded not in pattern but in texture. Perhaps this is what the Archivist feels all the time.`);
    } else if (material === 'crystal' && hasCrystal) {
      responses.push(`You press your palm against the crystal. It is warmer than you expected. For a moment, a flash of alien sensation — the compressed experience of the water that became this glass. Then it fades, and the crystal is just crystal again.`);
    } else {
      responses.push(`You reach out to touch what's around you in ${node.label}. The sensation is... real. Whatever this place is, it has substance.`);
    }
  } else {
    responses.push(`You attempt to ${input.toLowerCase()} in ${node.label}. The world responds... ambiguously. Perhaps a different approach would yield more insight.`);
  }

  return responses.join('\n\n');
}

export default function DungeonMaster({ currentNode, nodes, content, visible, onToggle }) {
  const [history, setHistory] = useState([]);
  const [input, setInput] = useState('');
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [history]);

  // Reset history when changing rooms
  useEffect(() => {
    setHistory([{
      role: 'dm',
      text: `You are in **${currentNode.label}** — a ${currentNode.type} in the multiverse.\n\n${currentNode.desc}\n\nWhat do you do?`,
    }]);
  }, [currentNode.id]);

  function handleSubmit(e) {
    e.preventDefault();
    if (!input.trim()) return;

    const playerInput = input.trim();
    setInput('');

    const response = generateResponse(playerInput, currentNode, nodes, content);

    setHistory(prev => [
      ...prev,
      { role: 'player', text: playerInput },
      { role: 'dm', text: response },
    ]);
  }

  if (!visible) {
    return (
      <button onClick={onToggle} style={{
        position: 'fixed', bottom: 20, right: 20, zIndex: 50,
        padding: '10px 18px', fontSize: 11,
        background: 'rgba(255,107,53,0.15)', border: '1px solid rgba(255,107,53,0.3)',
        borderRadius: 6, color: '#ff6b35', cursor: 'pointer',
        fontFamily: 'inherit', fontWeight: 600,
        boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
      }}>
        ◇ Open Dungeon Master
      </button>
    );
  }

  return (
    <div style={{
      position: 'fixed', bottom: 20, right: 20, zIndex: 50,
      width: 420, height: 500,
      background: '#0d0b15', border: '1px solid rgba(255,107,53,0.2)',
      borderRadius: 8, display: 'flex', flexDirection: 'column',
      boxShadow: '0 8px 40px rgba(0,0,0,0.5)',
    }}>
      {/* Header */}
      <div style={{
        padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <div>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#ff6b35' }}>◇ Dungeon Master</span>
          <span style={{ fontSize: 9, color: '#3a3550', marginLeft: 8 }}>{currentNode.label}</span>
        </div>
        <button onClick={onToggle} style={{
          background: 'none', border: 'none', color: '#665f7a',
          cursor: 'pointer', fontSize: 14, fontFamily: 'inherit',
        }}>×</button>
      </div>

      {/* Chat history */}
      <div ref={scrollRef} style={{
        flex: 1, overflowY: 'auto', padding: '12px 16px',
      }}>
        {history.map((msg, i) => (
          <div key={i} style={{
            marginBottom: 12,
            padding: '8px 12px',
            borderRadius: 6,
            background: msg.role === 'player'
              ? 'rgba(200,182,255,0.08)'
              : 'rgba(255,255,255,0.02)',
            borderLeft: msg.role === 'player'
              ? '2px solid #c8b6ff'
              : '2px solid rgba(255,107,53,0.3)',
          }}>
            <div style={{
              fontSize: 9, color: msg.role === 'player' ? '#c8b6ff' : '#ff6b35',
              letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4,
            }}>
              {msg.role === 'player' ? 'You' : 'DM'}
            </div>
            <div style={{
              fontSize: 11, color: '#a098b4', lineHeight: 1.7,
              whiteSpace: 'pre-wrap',
            }}
              dangerouslySetInnerHTML={{
                __html: msg.text
                  .replace(/\*\*(.+?)\*\*/g, '<strong style="color:#e8e4f0">$1</strong>')
                  .replace(/\*(.+?)\*/g, '<em>$1</em>')
              }}
            />
          </div>
        ))}
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} style={{
        padding: '12px 16px', borderTop: '1px solid rgba(255,255,255,0.06)',
        display: 'flex', gap: 8,
      }}>
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="What do you do? (burn, examine, listen, sing...)"
          style={{
            flex: 1, padding: '8px 12px', fontSize: 11,
            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 4, color: '#e8e4f0', fontFamily: 'inherit', outline: 'none',
          }}
          onFocus={e => e.target.style.borderColor = '#ff6b35'}
          onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.08)'}
        />
        <button type="submit" style={{
          padding: '8px 14px', fontSize: 11,
          background: 'rgba(255,107,53,0.15)', border: '1px solid rgba(255,107,53,0.3)',
          borderRadius: 4, color: '#ff6b35', cursor: 'pointer',
          fontFamily: 'inherit', fontWeight: 600,
        }}>
          →
        </button>
      </form>
    </div>
  );
}
