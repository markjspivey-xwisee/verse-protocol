import { useState } from 'react';

const REPO = 'markjspivey-xwisee/verse-protocol';

const TEMPLATE_MAP = {
  extends: 'verse-extend.yml',
  forks: 'verse-fork.yml',
  merges: 'verse-merge.yml',
};

const AFFORDANCE_ICONS = {
  unexplored_region: '◈',
  character_vacancy: '☉',
  undefined_system: '⚙',
  open_plotline: '◇',
  timeline_branch: '⚡',
  crossover_opportunity: '✦',
};

export default function ProposalBuilder({ affordance, parentNode, onClose }) {
  const [name, setName] = useState('');

  const relation = affordance?.suggestedRelation || 'extends';
  const type = affordance?.suggestedType || 'Verse';
  const template = TEMPLATE_MAP[relation] || TEMPLATE_MAP.extends;

  const labels = relation === 'merges'
    ? 'verse-proposal,merge'
    : relation === 'forks'
      ? 'verse-proposal,fork'
      : 'verse-proposal,extend';

  const titlePrefix = relation === 'forks' ? 'Fork' : relation === 'merges' ? 'Merge' : 'Extend';

  function handleSubmit() {
    const title = `[${titlePrefix}] ${name || 'Untitled'}`;
    const url = `https://github.com/${REPO}/issues/new?template=${template}&title=${encodeURIComponent(title)}&labels=${encodeURIComponent(labels)}`;
    window.open(url, '_blank');
    onClose();
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center',
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background: '#12101c', border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 8, padding: '28px 32px', width: 460,
        boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
      }}>
        <div style={{
          fontSize: 10, letterSpacing: '0.15em', textTransform: 'uppercase',
          color: '#c8b6ff', marginBottom: 6,
        }}>
          {AFFORDANCE_ICONS[affordance?.type] || '◇'} {affordance?.label || 'Create New Verse'}
        </div>

        <h3 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 700, color: '#fff' }}>
          Expand the World
        </h3>

        <p style={{ fontSize: 11, color: '#665f7a', lineHeight: 1.6, margin: '0 0 20px' }}>
          {affordance?.desc || `Add something new to ${parentNode?.label}.`}
        </p>

        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 10, color: '#3a3550', marginBottom: 6, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            Context
          </div>
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8,
            fontSize: 11, color: '#8a829e',
          }}>
            <div style={{
              padding: '8px 12px', background: 'rgba(255,255,255,0.03)',
              borderRadius: 4, border: '1px solid rgba(255,255,255,0.06)',
            }}>
              <div style={{ fontSize: 9, color: '#3a3550' }}>TYPE</div>
              <div>{type}</div>
            </div>
            <div style={{
              padding: '8px 12px', background: 'rgba(255,255,255,0.03)',
              borderRadius: 4, border: '1px solid rgba(255,255,255,0.06)',
            }}>
              <div style={{ fontSize: 9, color: '#3a3550' }}>RELATION</div>
              <div>{relation}</div>
            </div>
            <div style={{
              padding: '8px 12px', background: 'rgba(255,255,255,0.03)',
              borderRadius: 4, border: '1px solid rgba(255,255,255,0.06)',
            }}>
              <div style={{ fontSize: 9, color: '#3a3550' }}>PARENT</div>
              <div>{parentNode?.id}</div>
            </div>
          </div>
        </div>

        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 10, color: '#3a3550', marginBottom: 6, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            Name your creation
          </div>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder={`e.g., The ${type === 'Character' ? 'Wanderer' : type === 'Location' ? 'Obsidian Gate' : type === 'System' ? 'Echo Resonance' : 'Unnamed'}`}
            style={{
              width: '100%', padding: '10px 14px', fontSize: 13,
              background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 4, color: '#e8e4f0', fontFamily: 'inherit',
              outline: 'none',
            }}
            onFocus={e => e.target.style.borderColor = '#c8b6ff'}
            onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
            autoFocus
          />
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{
            padding: '8px 20px', fontSize: 11, cursor: 'pointer',
            background: 'transparent', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 4, color: '#665f7a', fontFamily: 'inherit',
          }}>
            Cancel
          </button>
          <button onClick={handleSubmit} style={{
            padding: '8px 20px', fontSize: 11, cursor: 'pointer',
            background: 'rgba(200,182,255,0.15)', border: '1px solid rgba(200,182,255,0.3)',
            borderRadius: 4, color: '#c8b6ff', fontFamily: 'inherit', fontWeight: 600,
          }}>
            Propose on GitHub →
          </button>
        </div>

        <div style={{ fontSize: 9, color: '#3a3550', marginTop: 12, textAlign: 'center' }}>
          Opens a pre-filled GitHub Issue. The verse-bot will create the node automatically.
        </div>
      </div>
    </div>
  );
}
