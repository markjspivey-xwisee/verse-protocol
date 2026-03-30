import { useState } from 'react';
import { renderMarkdown } from './renderMarkdown.js';

const TYPE_ICONS = {
  World: '◆', Verse: '◇', Character: '☉', Location: '◈',
  System: '⚙', Event: '⚡', Artifact: '✦', Faction: '⛊', Timeline: '↦',
};

const RELATION_COLORS = {
  extends: '#4ade80', forks: '#f59e0b', merges: '#818cf8',
  redefines: '#f43f5e', references: '#94a3b8',
};

const TYPE_FLAVOR = {
  World: 'You stand at the threshold of a world.',
  Location: 'You enter this place.',
  Character: 'Someone is here.',
  Artifact: 'Something catches your attention.',
  System: 'You sense the underlying rules of this reality.',
  Event: 'Something happened here.',
  Verse: 'A story unfolds.',
  Faction: 'An organization makes itself known.',
  Timeline: 'Time flows differently here.',
};

export default function NodeRoom({ node, content, authors, onNavigate }) {
  const [expanded, setExpanded] = useState(false);
  const author = authors[node.author];
  const icon = TYPE_ICONS[node.type] || '●';
  const md = content[node.id];

  return (
    <div style={{ padding: '16px' }}>
      {/* Room header */}
      <div style={{
        fontSize: 10, color: RELATION_COLORS[node.relation] || '#665f7a',
        letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 6,
      }}>
        {node.relation || 'origin'} · {node.type}
      </div>

      <h2 style={{
        margin: '0 0 8px', fontSize: 24, fontWeight: 700, color: '#fff',
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <span style={{ fontSize: 28 }}>{icon}</span> {node.label}
      </h2>

      {/* Atmospheric text */}
      <p style={{
        fontSize: 12, color: '#665f7a', fontStyle: 'italic',
        margin: '0 0 20px', lineHeight: 1.6,
      }}>
        {TYPE_FLAVOR[node.type]}
      </p>

      {/* Description */}
      <div style={{
        fontSize: 13, color: '#a098b4', lineHeight: 1.8,
        marginBottom: 20, maxWidth: 700,
      }}>
        {node.desc}
      </div>

      {/* Full content */}
      {md && (
        <div style={{ marginBottom: 24 }}>
          <button onClick={() => setExpanded(!expanded)} style={{
            background: 'rgba(200,182,255,0.06)', border: '1px solid rgba(200,182,255,0.15)',
            borderRadius: 4, padding: '8px 18px', cursor: 'pointer',
            color: '#c8b6ff', fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase',
            fontFamily: 'inherit', transition: 'all 0.2s',
          }}>
            {expanded ? '▼ Collapse Lore' : '▶ Read Full Lore'}
          </button>
          {expanded && (
            <div style={{
              marginTop: 12, padding: '16px 20px',
              background: 'rgba(255,255,255,0.02)', borderRadius: 6,
              border: '1px solid rgba(255,255,255,0.06)',
              maxHeight: 500, overflowY: 'auto',
            }}>
              {renderMarkdown(md)}
            </div>
          )}
        </div>
      )}

      {/* Author + epoch */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        fontSize: 10, color: '#3a3550', marginTop: 16,
      }}>
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: author?.color || '#665f7a' }} />
        <span style={{ color: author?.color || '#665f7a' }}>Created by {author?.name || node.author}</span>
        <span>· Epoch {node.epoch}</span>
      </div>
    </div>
  );
}
