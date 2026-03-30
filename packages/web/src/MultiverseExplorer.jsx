import { useState, useMemo } from 'react';
import { computeInfluence, computeAuthorStats, TYPE_ICONS, RELATION_COLORS } from '@verse-protocol/core';
import { AUTHORS, SEED_NODES, CONTENT } from './data/seed.js';
import CanvasDAG from './game/CanvasDAG.jsx';
import WorldView from './game/WorldView.jsx';
import EconomyView from './game/EconomyView.jsx';

// Color util for scores/authors views
function influenceColor(normalized) {
  const r = Math.round(40 + normalized * 215);
  const g = Math.round(20 + (1 - normalized) * 60 + normalized * 80);
  const b = Math.round(60 + (1 - normalized) * 140);
  return `rgb(${r},${g},${b})`;
}

// --- MAIN COMPONENT ---
export default function MultiverseExplorer() {
  const [nodes] = useState(SEED_NODES);
  const [selected, setSelected] = useState(null);
  const [hoveredNode, setHoveredNode] = useState(null);
  const [view, setView] = useState('dag');
  const [showContent, setShowContent] = useState(false);

  const scores = useMemo(() => computeInfluence(nodes), [nodes]);

  const selectedNode = nodes.find(n => n.id === selected);
  const hoveredData = nodes.find(n => n.id === hoveredNode);


  const sortedByInfluence = useMemo(() =>
    [...nodes].sort((a, b) => (scores[b.id]?.total || 0) - (scores[a.id]?.total || 0)),
    [nodes, scores]
  );

  const authorStats = useMemo(() =>
    computeAuthorStats(nodes, AUTHORS, scores),
    [nodes, scores]
  );

  return (
    <div style={{
      width: '100%', minHeight: '100vh',
      background: 'linear-gradient(160deg, #0a0a0f 0%, #12101c 40%, #0d0f18 100%)',
      color: '#e8e4f0', fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
      overflow: 'hidden',
    }}>
      {/* Grid overlay */}
      <div style={{
        position: 'fixed', inset: 0, pointerEvents: 'none',
        backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.03) 1px, transparent 0)',
        backgroundSize: '40px 40px',
      }} />

      {/* Header */}
      <header style={{
        padding: '12px 16px 10px', borderBottom: '1px solid rgba(255,255,255,0.06)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        position: 'relative', zIndex: 10, flexWrap: 'wrap', gap: 8,
      }}>
        <div>
          <h1 style={{
            margin: 0, fontSize: 22, fontWeight: 700, letterSpacing: '0.08em',
            background: 'linear-gradient(135deg, #ff6b35, #ff4081, #7b68ee)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          }}>
            {TYPE_ICONS.World} VERSE PROTOCOL
          </h1>
          <div style={{ fontSize: 11, color: '#665f7a', marginTop: 4, letterSpacing: '0.15em', textTransform: 'uppercase' }}>
            Proof of Creativity &middot; Multiverse DAG Explorer &middot; v0.1
          </div>
        </div>
        <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
          {['dag', 'scores', 'authors', 'world', 'economy'].map(v => (
            <button key={v} onClick={() => setView(v)} style={{
              padding: '6px 16px', fontSize: 11, letterSpacing: '0.1em',
              textTransform: 'uppercase', cursor: 'pointer', border: '1px solid',
              borderColor: view === v ? '#ff6b35' : 'rgba(255,255,255,0.1)',
              background: view === v ? 'rgba(255,107,53,0.15)' : 'transparent',
              color: view === v ? '#ff6b35' : '#665f7a',
              borderRadius: 4, transition: 'all 0.2s',
              fontFamily: 'inherit',
            }}>
              {v}
            </button>
          ))}
        </div>
      </header>

      <div style={{ display: 'flex', height: 'calc(100vh - 80px)' }}>
        {/* Main area */}
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>

          {/* ============ DAG VIEW ============ */}
          {view === 'dag' && (
            <CanvasDAG
              nodes={nodes}
              scores={scores}
              authors={AUTHORS}
              selected={selected}
              onSelect={(id) => { setSelected(id); setShowContent(false); }}
              onHover={setHoveredNode}
            />
          )}

          {/* ============ SCORES VIEW ============ */}
          {view === 'scores' && (
            <div style={{ padding: '16px', maxWidth: 900, margin: '0 auto', overflowY: 'auto', height: '100%' }}>
              <h2 style={{ fontSize: 14, letterSpacing: '0.15em', color: '#665f7a', textTransform: 'uppercase', marginBottom: 20 }}>
                Influence Leaderboard &middot; Epoch 8
              </h2>
              {sortedByInfluence.map((n, i) => {
                const sc = scores[n.id];
                const author = AUTHORS[n.author];
                return (
                  <div key={n.id} onClick={() => { setSelected(n.id); setView('dag'); }}
                    style={{
                      display: 'grid', gridTemplateColumns: '30px 1fr auto',
                      alignItems: 'center', gap: 8, padding: '10px 16px',
                      background: i % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent',
                      borderRadius: 4, cursor: 'pointer', fontSize: 11,
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,107,53,0.08)'}
                    onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent'}
                  >
                    <span style={{ color: '#3a3550', fontWeight: 700 }}>#{i + 1}</span>
                    <div>
                      <span style={{ fontWeight: 600 }}>{TYPE_ICONS[n.type]} {n.label}</span>
                      <span style={{ color: author?.color, marginLeft: 8, fontSize: 10 }}>@{author?.name}</span>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ color: '#665f7a', fontSize: 9 }}>DEPTH</div>
                      <div>{sc.forkDepth}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ color: '#665f7a', fontSize: 9 }}>REUSE</div>
                      <div>{sc.reuseCount}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ color: '#665f7a', fontSize: 9 }}>MERGE</div>
                      <div>{(sc.mergeCentrality * 100).toFixed(0)}%</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ color: '#665f7a', fontSize: 9 }}>NOVEL</div>
                      <div>{sc.noveltyDelta.toFixed(2)}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{
                        display: 'inline-block', padding: '2px 10px',
                        background: `rgba(255,107,53,${0.1 + sc.normalized * 0.3})`,
                        border: `1px solid rgba(255,107,53,${0.2 + sc.normalized * 0.4})`,
                        borderRadius: 3, fontWeight: 700,
                        color: influenceColor(sc.normalized),
                      }}>
                        {sc.total.toFixed(2)}
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Formula */}
              <div style={{
                marginTop: 32, padding: 20, background: 'rgba(255,255,255,0.02)',
                borderRadius: 6, border: '1px solid rgba(255,255,255,0.06)',
                fontSize: 11, color: '#665f7a', lineHeight: 1.8,
              }}>
                <div style={{ fontWeight: 700, color: '#8a829e', marginBottom: 8, letterSpacing: '0.1em' }}>SCORING FORMULA</div>
                <code style={{ color: '#ff6b35' }}>
                  I(v) = 0.25&middot;ForkDepth(v) + 0.30&middot;ReuseCount(v) + 0.25&middot;MergeCentrality(v)&middot;10 + 0.20&middot;Novelty&Delta;(v)
                </code>
                <div style={{ marginTop: 12 }}>
                  <strong style={{ color: '#4ade80' }}>ForkDepth</strong> — max depth of descendant tree &middot;
                  <strong style={{ color: '#818cf8' }}> ReuseCount</strong> — total downstream verse:reuses edges &middot;
                  <strong style={{ color: '#f59e0b' }}> MergeCentrality</strong> — fraction of merges including this object &middot;
                  <strong style={{ color: '#f43f5e' }}> Novelty&Delta;</strong> — KL divergence &times; downstream adoption
                </div>
              </div>
            </div>
          )}

          {/* ============ AUTHORS VIEW ============ */}
          {view === 'authors' && (
            <div style={{ padding: '16px', maxWidth: 700, margin: '0 auto', overflowY: 'auto', height: '100%' }}>
              <h2 style={{ fontSize: 14, letterSpacing: '0.15em', color: '#665f7a', textTransform: 'uppercase', marginBottom: 20 }}>
                Author Rewards &middot; Epoch 8
              </h2>
              {authorStats.map((a) => {
                const maxScore = Math.max(...authorStats.map(x => x.totalScore));
                return (
                  <div key={a.id} style={{
                    padding: '16px 20px', marginBottom: 12,
                    background: 'rgba(255,255,255,0.02)', borderRadius: 6,
                    border: '1px solid rgba(255,255,255,0.06)',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <span style={{ fontSize: 16, fontWeight: 700, color: a.color }}>
                          {a.isAgent ? '\uD83E\uDD16 ' : ''}{a.name}
                        </span>
                        <span style={{ fontSize: 10, color: '#3a3550', marginLeft: 12 }}>{a.eth}</span>
                        {a.isAgent && (
                          <span style={{ fontSize: 9, color: '#665f7a', marginLeft: 8 }}>
                            &rarr; directed by {AUTHORS[a.director]?.name}
                          </span>
                        )}
                      </div>
                      <div style={{
                        fontSize: 18, fontWeight: 700,
                        color: influenceColor(a.totalScore / maxScore),
                      }}>
                        {a.totalScore.toFixed(2)}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 24, marginTop: 12, fontSize: 10, color: '#665f7a' }}>
                      <span>{a.count} verses</span>
                      <span>{a.merges} merges</span>
                      <span>{a.redefines} redefines</span>
                      <span style={{ marginLeft: 'auto', color: '#ff6b35' }}>
                        &asymp; {(a.totalScore * 100).toFixed(0)} $VERSE tokens
                      </span>
                    </div>
                    <div style={{
                      marginTop: 8, height: 3, background: 'rgba(255,255,255,0.05)',
                      borderRadius: 2, overflow: 'hidden',
                    }}>
                      <div style={{
                        width: `${(a.totalScore / maxScore) * 100}%`,
                        height: '100%', background: a.color, borderRadius: 2,
                        transition: 'width 0.5s ease',
                      }} />
                    </div>
                  </div>
                );
              })}

              <div style={{
                marginTop: 24, padding: 16, background: 'rgba(255,255,255,0.02)',
                borderRadius: 6, border: '1px solid rgba(255,255,255,0.06)',
                fontSize: 10, color: '#665f7a', lineHeight: 1.8,
              }}>
                <div style={{ fontWeight: 700, color: '#8a829e', marginBottom: 4 }}>REWARD MECHANICS</div>
                Token mint &prop; &Delta;influence per epoch. Agent rewards flow to their director.
                On-chain: EAS attestation per authorship claim + epoch Merkle root snapshot.
                Revenue share propagates backward through verse:reuses edges.
              </div>
            </div>
          )}

          {/* ============ WORLD VIEW ============ */}
          {view === 'world' && (
            <WorldView
              nodes={nodes}
              scores={scores}
              content={CONTENT}
              authors={AUTHORS}
              selected={selected}
              onSelectNode={(id) => setSelected(id)}
            />
          )}

          {/* ============ ECONOMY VIEW ============ */}
          {view === 'economy' && (
            <EconomyView
              nodes={nodes}
              scores={scores}
              authors={AUTHORS}
            />
          )}
        </div>

        {/* ============ DETAIL PANEL ============ */}
        {selected && selectedNode && (
          <div style={{
            width: window.innerWidth < 768 ? '100%' : 320,
            position: window.innerWidth < 768 ? 'fixed' : 'relative',
            inset: window.innerWidth < 768 ? 0 : 'auto',
            zIndex: window.innerWidth < 768 ? 50 : 'auto',
            borderLeft: window.innerWidth < 768 ? 'none' : '1px solid rgba(255,255,255,0.06)',
            padding: '24px 20px', overflowY: 'auto',
            background: window.innerWidth < 768 ? 'rgba(10,8,18,0.98)' : 'rgba(10,8,18,0.6)',
          }}>
            <button onClick={() => setSelected(null)} style={{
              float: 'right', background: 'none', border: 'none',
              color: '#665f7a', cursor: 'pointer', fontSize: 16, fontFamily: 'inherit',
            }}>&times;</button>

            <div style={{
              fontSize: 10, color: RELATION_COLORS[selectedNode.relation] || '#665f7a',
              letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 4,
            }}>
              {selectedNode.relation || 'origin'} &middot; {selectedNode.type}
            </div>

            <h3 style={{ margin: '4px 0 12px', fontSize: 18, fontWeight: 700, color: '#fff' }}>
              {TYPE_ICONS[selectedNode.type]} {selectedNode.label}
            </h3>

            <p style={{ fontSize: 12, color: '#8a829e', lineHeight: 1.6, margin: '0 0 20px' }}>
              {selectedNode.desc}
            </p>

            {/* Full content toggle */}
            {CONTENT[selectedNode.id] && (() => {
              const md = CONTENT[selectedNode.id];
              const renderContent = (text) => {
                return text.split('\n').map((line, i) => {
                  if (line.startsWith('# ')) return null;
                  if (line.startsWith('## ')) return <div key={i} style={{ fontSize: 12, fontWeight: 700, color: '#c8b6ff', marginTop: 16, marginBottom: 6 }}>{line.replace('## ', '')}</div>;
                  if (line.startsWith('### ')) return <div key={i} style={{ fontSize: 11, fontWeight: 700, color: '#a098b4', marginTop: 12, marginBottom: 4 }}>{line.replace('### ', '')}</div>;
                  if (line.startsWith('- **')) return <div key={i} style={{ fontSize: 11, color: '#8a829e', lineHeight: 1.6, paddingLeft: 12 }} dangerouslySetInnerHTML={{ __html: line.replace(/\*\*(.+?)\*\*/g, '<strong style="color:#e8e4f0">$1</strong>').replace(/\*(.+?)\*/g, '<em>$1</em>').replace(/^- /, '\u2022 ') }} />;
                  if (line.startsWith('- ')) return <div key={i} style={{ fontSize: 11, color: '#8a829e', lineHeight: 1.6, paddingLeft: 12 }}>{'\u2022 '}{line.slice(2)}</div>;
                  if (line.startsWith('|') && line.includes('---|')) return null;
                  if (line.startsWith('|')) return <div key={i} style={{ fontSize: 10, color: '#665f7a', lineHeight: 1.8, fontFamily: 'monospace' }}>{line}</div>;
                  if (line.startsWith('---')) return null;
                  if (line.startsWith('**') && line.endsWith('**')) return <div key={i} style={{ fontSize: 11, color: '#a098b4', lineHeight: 1.6, marginTop: 4 }}><strong>{line.replace(/\*\*/g, '')}</strong></div>;
                  if (line.trim() === '') return <div key={i} style={{ height: 8 }} />;
                  return <div key={i} style={{ fontSize: 11, color: '#8a829e', lineHeight: 1.7 }} dangerouslySetInnerHTML={{ __html: line.replace(/\*\*(.+?)\*\*/g, '<strong style="color:#e8e4f0">$1</strong>').replace(/\*(.+?)\*/g, '<em>$1</em>') }} />;
                });
              };
              return (
                <div style={{ marginBottom: 16 }}>
                  <button onClick={() => setShowContent(!showContent)} style={{
                    background: 'rgba(200,182,255,0.08)', border: '1px solid rgba(200,182,255,0.2)',
                    borderRadius: 4, padding: '6px 14px', cursor: 'pointer',
                    color: '#c8b6ff', fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase',
                    fontFamily: 'inherit', width: '100%', textAlign: 'left',
                  }}>
                    {showContent ? '\u25BC' : '\u25B6'} Full Lore
                  </button>
                  {showContent && (
                    <div style={{
                      marginTop: 8, padding: '12px 14px',
                      background: 'rgba(255,255,255,0.02)', borderRadius: 4,
                      border: '1px solid rgba(255,255,255,0.06)',
                      maxHeight: 400, overflowY: 'auto',
                    }}>
                      {renderContent(md)}
                    </div>
                  )}
                </div>
              );
            })()}

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20, fontSize: 11 }}>
              <div style={{
                width: 8, height: 8, borderRadius: '50%',
                background: AUTHORS[selectedNode.author]?.color,
              }} />
              <span style={{ color: AUTHORS[selectedNode.author]?.color }}>
                {AUTHORS[selectedNode.author]?.name}
              </span>
              <span style={{ color: '#3a3550' }}>&middot; Epoch {selectedNode.epoch}</span>
            </div>

            {/* Score breakdown */}
            <div style={{ fontSize: 10, letterSpacing: '0.1em', color: '#665f7a', textTransform: 'uppercase', marginBottom: 8 }}>
              Influence Breakdown
            </div>
            {(() => {
              const sc = scores[selectedNode.id];
              const metrics = [
                { label: 'Fork Depth', value: sc.forkDepth, max: 8, color: '#4ade80' },
                { label: 'Structural Reuse', value: sc.reuseCount, max: 15, color: '#818cf8' },
                { label: 'Merge Centrality', value: sc.mergeCentrality, max: 1, color: '#f59e0b' },
                { label: 'Novelty Delta', value: sc.noveltyDelta, max: 2, color: '#f43f5e' },
              ];
              return metrics.map(m => (
                <div key={m.label} style={{ marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, marginBottom: 3 }}>
                    <span style={{ color: '#8a829e' }}>{m.label}</span>
                    <span style={{ color: m.color, fontWeight: 600 }}>
                      {typeof m.value === 'number' ? (m.value < 1 && m.value > 0 ? (m.value * 100).toFixed(0) + '%' : m.value.toFixed(2)) : m.value}
                    </span>
                  </div>
                  <div style={{ height: 3, background: 'rgba(255,255,255,0.05)', borderRadius: 2 }}>
                    <div style={{
                      width: `${Math.min((m.value / m.max) * 100, 100)}%`,
                      height: '100%', background: m.color, borderRadius: 2,
                    }} />
                  </div>
                </div>
              ));
            })()}

            <div style={{
              marginTop: 16, padding: '10px 14px',
              background: 'rgba(255,107,53,0.08)', border: '1px solid rgba(255,107,53,0.2)',
              borderRadius: 4, textAlign: 'center',
            }}>
              <div style={{ fontSize: 9, color: '#665f7a', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                Total Influence
              </div>
              <div style={{ fontSize: 24, fontWeight: 700, color: '#ff6b35' }}>
                {scores[selectedNode.id].total.toFixed(3)}
              </div>
            </div>

            {/* Parents */}
            {selectedNode.parents?.length > 0 && (
              <div style={{ marginTop: 20 }}>
                <div style={{ fontSize: 10, color: '#665f7a', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>
                  Derives From
                </div>
                {selectedNode.parents.map(pid => {
                  const parent = nodes.find(n => n.id === pid);
                  return parent ? (
                    <div key={pid} onClick={() => setSelected(pid)}
                      style={{
                        padding: '6px 10px', marginBottom: 4, fontSize: 11,
                        background: 'rgba(255,255,255,0.03)', borderRadius: 3,
                        cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                      }}>
                      <span>{TYPE_ICONS[parent.type]}</span>
                      <span>{parent.label}</span>
                    </div>
                  ) : null;
                })}
              </div>
            )}

            {/* Children */}
            {(() => {
              const children = nodes.filter(n => n.parents?.includes(selectedNode.id));
              if (children.length === 0) return null;
              return (
                <div style={{ marginTop: 16 }}>
                  <div style={{ fontSize: 10, color: '#665f7a', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>
                    Extended By
                  </div>
                  {children.map(child => (
                    <div key={child.id} onClick={() => setSelected(child.id)}
                      style={{
                        padding: '6px 10px', marginBottom: 4, fontSize: 11,
                        background: 'rgba(255,255,255,0.03)', borderRadius: 3,
                        cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                      }}>
                      <span style={{ color: RELATION_COLORS[child.relation] }}>{TYPE_ICONS[child.type]}</span>
                      <span>{child.label}</span>
                      <span style={{ marginLeft: 'auto', fontSize: 9, color: RELATION_COLORS[child.relation] }}>
                        {child.relation}
                      </span>
                    </div>
                  ))}
                </div>
              );
            })()}

            {/* Git provenance */}
            <div style={{
              marginTop: 20, padding: '10px 14px',
              background: 'rgba(255,255,255,0.02)', borderRadius: 4,
              fontSize: 10, color: '#3a3550', fontFamily: 'monospace', lineHeight: 1.8,
            }}>
              <div style={{ color: '#665f7a', marginBottom: 4 }}>GIT PROVENANCE</div>
              <div>commit: <span style={{ color: '#8a829e' }}>{selectedNode.id}a3f8...2b1e</span></div>
              <div>branch: <span style={{ color: '#8a829e' }}>{selectedNode.label.toLowerCase().replace(/\s/g, '-')}</span></div>
              <div>repo: <span style={{ color: '#8a829e' }}>verse://{AUTHORS[selectedNode.author]?.name.toLowerCase()}/{selectedNode.id}</span></div>
              <div>EAS: <span style={{ color: '#4ade80' }}>attested &#10003;</span></div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
