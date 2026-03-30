import { useState, useMemo } from 'react';
import { buildWorldGraph, detectAffordances, ROOM_TYPES, ENTITY_TYPES } from './worldGraph.js';
import NodeRoom from './NodeRoom.jsx';
import ProposalBuilder from './ProposalBuilder.jsx';
import ActivityFeed from './ActivityFeed.jsx';
import DungeonMaster from './DungeonMaster.jsx';
import EpochReplay from './EpochReplay.jsx';
import { usePresence } from './usePresence.js';

const TYPE_ICONS = {
  World: '◆', Verse: '◇', Character: '☉', Location: '◈',
  System: '⚙', Event: '⚡', Artifact: '✦', Faction: '⛊', Timeline: '↦',
};

const RELATION_COLORS = {
  extends: '#4ade80', forks: '#f59e0b', merges: '#818cf8',
  redefines: '#f43f5e', references: '#94a3b8',
};

const AFFORDANCE_COLORS = {
  unexplored_region: '#06b6d4',
  character_vacancy: '#f59e0b',
  undefined_system: '#818cf8',
  open_plotline: '#4ade80',
  timeline_branch: '#f43f5e',
  crossover_opportunity: '#c8b6ff',
};

const AFFORDANCE_ICONS = {
  unexplored_region: '◈',
  character_vacancy: '☉',
  undefined_system: '⚙',
  open_plotline: '◇',
  timeline_branch: '⚡',
  crossover_opportunity: '✦',
};

export default function WorldView({ nodes, scores, content, authors, selected, onSelectNode }) {
  const [currentId, setCurrentId] = useState(selected || nodes[0]?.id || 'v1');
  const [proposal, setProposal] = useState(null);
  const [dmVisible, setDmVisible] = useState(false);
  const [showReplay, setShowReplay] = useState(false);

  const graph = useMemo(() => buildWorldGraph(nodes), [nodes]);
  const affordances = useMemo(() => detectAffordances(nodes), [nodes]);

  const { peers } = usePresence(currentId);

  const byId = useMemo(() => Object.fromEntries(nodes.map(n => [n.id, n])), [nodes]);
  const current = byId[currentId];
  const graphNode = graph[currentId];

  if (!current || !graphNode) return <div style={{ padding: 32, color: '#665f7a' }}>Node not found.</div>;

  // Build breadcrumb path from root to current
  const breadcrumb = [];
  function buildBreadcrumb(id, visited = new Set()) {
    if (visited.has(id)) return;
    visited.add(id);
    const n = byId[id];
    if (!n) return;
    if (n.parents?.length) buildBreadcrumb(n.parents[0], visited);
    breadcrumb.push(n);
  }
  buildBreadcrumb(currentId);

  function navigate(id) {
    setCurrentId(id);
    onSelectNode(id);
  }

  // Group entities by type
  const entityGroups = {};
  for (const eid of graphNode.entities) {
    const e = byId[eid];
    if (!e) continue;
    if (!entityGroups[e.type]) entityGroups[e.type] = [];
    entityGroups[e.type].push(e);
  }

  // Navigation destinations
  const destinations = [
    ...graphNode.rooms.map(id => ({ id, node: byId[id], category: 'Within' })),
    ...graphNode.siblings.filter(id => !graphNode.rooms.includes(id)).map(id => ({ id, node: byId[id], category: 'Nearby' })),
    ...graphNode.portals.filter(id => !graphNode.rooms.includes(id) && !graphNode.siblings.includes(id)).map(id => ({ id, node: byId[id], category: 'Portal' })),
  ].filter(d => d.node);

  // Group destinations by category
  const destGroups = {};
  for (const d of destinations) {
    if (!destGroups[d.category]) destGroups[d.category] = [];
    destGroups[d.category].push(d);
  }

  const currentAffordances = affordances[currentId] || [];
  const peersHere = peers.filter(p => p.nodeId === currentId);

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      {/* Main content area */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {/* Breadcrumb */}
        <div style={{
          padding: '12px 32px', borderBottom: '1px solid rgba(255,255,255,0.04)',
          display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap',
          fontSize: 10, color: '#3a3550',
        }}>
          {breadcrumb.map((n, i) => (
            <span key={n.id} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              {i > 0 && <span style={{ color: '#2a2540', margin: '0 2px' }}>›</span>}
              <span
                onClick={() => n.id !== currentId && navigate(n.id)}
                style={{
                  cursor: n.id !== currentId ? 'pointer' : 'default',
                  color: n.id === currentId ? '#a098b4' : '#3a3550',
                  transition: 'color 0.15s',
                }}
                onMouseEnter={e => { if (n.id !== currentId) e.target.style.color = '#c8b6ff'; }}
                onMouseLeave={e => { if (n.id !== currentId) e.target.style.color = '#3a3550'; }}
              >
                {TYPE_ICONS[n.type]} {n.label}
              </span>
            </span>
          ))}
        </div>

        {/* Room content */}
        <NodeRoom
          node={current}
          content={content}
          authors={authors}
          onNavigate={navigate}
        />

        {/* Navigation paths */}
        {Object.keys(destGroups).length > 0 && (
          <div style={{ padding: '0 32px 32px' }}>
            <div style={{
              fontSize: 10, letterSpacing: '0.15em', textTransform: 'uppercase',
              color: '#665f7a', marginBottom: 12,
            }}>
              Paths from here
            </div>
            {Object.entries(destGroups).map(([category, dests]) => (
              <div key={category} style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 9, color: '#3a3550', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>
                  {category}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 8 }}>
                  {dests.map(({ id, node: dest }) => {
                    const sc = scores[id];
                    return (
                      <div key={id} onClick={() => navigate(id)}
                        style={{
                          padding: '12px 16px', background: 'rgba(255,255,255,0.02)',
                          border: '1px solid rgba(255,255,255,0.06)', borderRadius: 6,
                          cursor: 'pointer', transition: 'all 0.2s',
                        }}
                        onMouseEnter={e => {
                          e.currentTarget.style.background = 'rgba(200,182,255,0.06)';
                          e.currentTarget.style.borderColor = 'rgba(200,182,255,0.15)';
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.background = 'rgba(255,255,255,0.02)';
                          e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)';
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                          <span style={{ fontSize: 16 }}>{TYPE_ICONS[dest.type]}</span>
                          <span style={{ fontSize: 12, fontWeight: 600, color: '#e8e4f0' }}>{dest.label}</span>
                          {dest.relation && (
                            <span style={{
                              marginLeft: 'auto', fontSize: 9,
                              color: RELATION_COLORS[dest.relation] || '#665f7a',
                              letterSpacing: '0.05em',
                            }}>
                              {dest.relation}
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: 10, color: '#665f7a', lineHeight: 1.5, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                          {dest.desc}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Go back */}
        {current.parents?.length > 0 && (
          <div style={{ padding: '0 32px 32px' }}>
            <button onClick={() => navigate(current.parents[0])} style={{
              padding: '8px 20px', fontSize: 11, cursor: 'pointer',
              background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 4, color: '#665f7a', fontFamily: 'inherit',
              transition: 'all 0.2s',
            }}
              onMouseEnter={e => e.target.style.color = '#a098b4'}
              onMouseLeave={e => e.target.style.color = '#665f7a'}
            >
              ← Back to {byId[current.parents[0]]?.label || 'parent'}
            </button>
          </div>
        )}
      </div>

      {/* Sidebar */}
      <div style={{
        width: 300, borderLeft: '1px solid rgba(255,255,255,0.06)',
        padding: '20px 16px', overflowY: 'auto',
        background: 'rgba(10,8,18,0.6)',
      }}>
        {/* Entities here */}
        {Object.keys(entityGroups).length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 10, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#665f7a', marginBottom: 8 }}>
              Here you find
            </div>
            {Object.entries(entityGroups).map(([type, entities]) => (
              <div key={type} style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 9, color: '#3a3550', letterSpacing: '0.1em', marginBottom: 4 }}>{type}s</div>
                {entities.map(e => (
                  <div key={e.id} onClick={() => navigate(e.id)}
                    style={{
                      padding: '8px 10px', marginBottom: 3, fontSize: 11,
                      background: 'rgba(255,255,255,0.02)', borderRadius: 3,
                      cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(200,182,255,0.06)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
                  >
                    <span style={{ fontSize: 14 }}>{TYPE_ICONS[type]}</span>
                    <div>
                      <div style={{ color: '#a098b4', fontWeight: 600 }}>{e.label}</div>
                      <div style={{ fontSize: 9, color: '#3a3550', marginTop: 1 }}>{e.desc?.substring(0, 60)}...</div>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}

        {/* Expansion points */}
        {currentAffordances.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 10, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#665f7a', marginBottom: 8 }}>
              Expansion Points
            </div>
            {currentAffordances.map((aff, i) => (
              <div key={i}
                onClick={() => setProposal(aff)}
                style={{
                  padding: '10px 12px', marginBottom: 6,
                  background: `${AFFORDANCE_COLORS[aff.type]}08`,
                  border: `1px solid ${AFFORDANCE_COLORS[aff.type]}25`,
                  borderRadius: 4, cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = `${AFFORDANCE_COLORS[aff.type]}15`;
                  e.currentTarget.style.borderColor = `${AFFORDANCE_COLORS[aff.type]}40`;
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = `${AFFORDANCE_COLORS[aff.type]}08`;
                  e.currentTarget.style.borderColor = `${AFFORDANCE_COLORS[aff.type]}25`;
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                  <span style={{ color: AFFORDANCE_COLORS[aff.type], fontSize: 14 }}>
                    {AFFORDANCE_ICONS[aff.type]}
                  </span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: AFFORDANCE_COLORS[aff.type] }}>
                    {aff.label}
                  </span>
                </div>
                <div style={{ fontSize: 9, color: '#665f7a', lineHeight: 1.4 }}>
                  {aff.desc}
                </div>
                <div style={{ fontSize: 8, color: '#3a3550', marginTop: 4 }}>
                  Click to propose a {aff.suggestedType}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Presence */}
        {peers.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 10, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#665f7a', marginBottom: 8 }}>
              Other Explorers
            </div>
            <div style={{ fontSize: 11, color: '#4ade80' }}>
              {peersHere.length > 0 ? `${peersHere.length} here with you` : ''}
            </div>
            <div style={{ fontSize: 10, color: '#3a3550', marginTop: 4 }}>
              {peers.length} explorer{peers.length !== 1 ? 's' : ''} in the multiverse
            </div>
          </div>
        )}

        {/* Activity feed */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 10, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#665f7a', marginBottom: 8 }}>
            Recent Activity
          </div>
          <ActivityFeed />
        </div>

        {/* Create button */}
        <button
          onClick={() => setProposal({
            type: 'open_plotline',
            label: 'Create Something Here',
            desc: `Add to ${current.label}.`,
            suggestedType: 'Verse',
            suggestedRelation: 'extends',
          })}
          style={{
            width: '100%', padding: '10px 16px', fontSize: 11,
            background: 'rgba(255,107,53,0.1)', border: '1px solid rgba(255,107,53,0.25)',
            borderRadius: 4, color: '#ff6b35', cursor: 'pointer',
            fontFamily: 'inherit', fontWeight: 600, letterSpacing: '0.05em',
            transition: 'all 0.2s',
          }}
          onMouseEnter={e => {
            e.target.style.background = 'rgba(255,107,53,0.2)';
            e.target.style.borderColor = 'rgba(255,107,53,0.4)';
          }}
          onMouseLeave={e => {
            e.target.style.background = 'rgba(255,107,53,0.1)';
            e.target.style.borderColor = 'rgba(255,107,53,0.25)';
          }}
        >
          + Create Something Here
        </button>

        {/* Epoch replay button */}
        <button
          onClick={() => setShowReplay(true)}
          style={{
            width: '100%', padding: '10px 16px', fontSize: 11, marginTop: 8,
            background: 'rgba(200,182,255,0.06)', border: '1px solid rgba(200,182,255,0.15)',
            borderRadius: 4, color: '#c8b6ff', cursor: 'pointer',
            fontFamily: 'inherit', letterSpacing: '0.05em',
            transition: 'all 0.2s',
          }}
          onMouseEnter={e => {
            e.target.style.background = 'rgba(200,182,255,0.12)';
            e.target.style.borderColor = 'rgba(200,182,255,0.3)';
          }}
          onMouseLeave={e => {
            e.target.style.background = 'rgba(200,182,255,0.06)';
            e.target.style.borderColor = 'rgba(200,182,255,0.15)';
          }}
        >
          ◆ Watch World Grow
        </button>
      </div>

      {/* Proposal modal */}
      {proposal && (
        <ProposalBuilder
          affordance={proposal}
          parentNode={current}
          onClose={() => setProposal(null)}
        />
      )}

      {/* Dungeon Master */}
      <DungeonMaster
        currentNode={current}
        nodes={nodes}
        content={content}
        visible={dmVisible}
        onToggle={() => setDmVisible(!dmVisible)}
      />

      {/* Epoch Replay */}
      {showReplay && (
        <EpochReplay
          allNodes={nodes}
          onClose={() => setShowReplay(false)}
        />
      )}
    </div>
  );
}
