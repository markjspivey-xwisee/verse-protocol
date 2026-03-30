import { useState, useMemo } from 'react';
import { computeInfluence, computeAuthorStats } from '@verse-protocol/core';

/**
 * Economy View — Token dashboard, bounty board, IP market, governance.
 *
 * Pre-deployment: shows simulated tokenomics based on influence scores.
 * Post-deployment: reads from on-chain data via ethers.js.
 */

// Bonding curve simulation (mirrors VerseToken.sol)
const BASE_PRICE = 0.0001; // ETH
const SLOPE = 0.00000001;

function bondingCurvePrice(totalSupply) {
  return BASE_PRICE + SLOPE * totalSupply * totalSupply;
}

function simulateBondingCurve(maxSupply, steps = 50) {
  const points = [];
  for (let i = 0; i <= steps; i++) {
    const supply = (maxSupply / steps) * i;
    points.push({ supply, price: bondingCurvePrice(supply) });
  }
  return points;
}

const TAB_STYLE = (active) => ({
  padding: '6px 16px', fontSize: 10, letterSpacing: '0.1em',
  textTransform: 'uppercase', cursor: 'pointer', border: '1px solid',
  borderColor: active ? '#ff6b35' : 'rgba(255,255,255,0.1)',
  background: active ? 'rgba(255,107,53,0.15)' : 'transparent',
  color: active ? '#ff6b35' : '#665f7a',
  borderRadius: 4, fontFamily: 'inherit',
});

export default function EconomyView({ nodes, scores, authors }) {
  const [tab, setTab] = useState('dashboard');

  const authorStats = useMemo(() =>
    computeAuthorStats(nodes, authors, scores),
    [nodes, authors, scores]
  );

  // Simulated total supply based on all influence scores
  const totalProjectedSupply = useMemo(() =>
    Object.values(scores).reduce((sum, s) => sum + s.total * 100, 0),
    [scores]
  );

  const curveData = useMemo(() =>
    simulateBondingCurve(Math.max(totalProjectedSupply * 2, 10000)),
    [totalProjectedSupply]
  );

  const currentPrice = bondingCurvePrice(totalProjectedSupply);

  // Simulated bounties from affordances
  const simulatedBounties = useMemo(() => {
    const childTypeMap = {};
    for (const n of nodes) {
      childTypeMap[n.id] = new Set();
    }
    for (const n of nodes) {
      if (n.parents) {
        for (const pid of n.parents) {
          if (childTypeMap[pid]) childTypeMap[pid].add(n.type);
        }
      }
    }

    const bounties = [];
    for (const n of nodes) {
      const ct = childTypeMap[n.id];
      if ((n.type === 'World' || n.type === 'Location') && !ct.has('Location')) {
        bounties.push({ parentId: n.id, parentLabel: n.label, type: 'Location', reward: 50, status: 'open' });
      }
      if ((n.type === 'Location' || n.type === 'Faction') && !ct.has('Character')) {
        bounties.push({ parentId: n.id, parentLabel: n.label, type: 'Character', reward: 30, status: 'open' });
      }
      if ((n.type === 'Character' || n.type === 'Event') && !ct.has('Verse') && !ct.has('Event')) {
        bounties.push({ parentId: n.id, parentLabel: n.label, type: 'Verse', reward: 20, status: 'open' });
      }
    }
    return bounties;
  }, [nodes]);

  return (
    <div style={{ padding: '24px 32px', maxWidth: 1000, margin: '0 auto', overflowY: 'auto', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#ff6b35' }}>
            $VERSE Economy
          </h2>
          <div style={{ fontSize: 10, color: '#3a3550', marginTop: 2 }}>
            Bonding curve · Base Sepolia · Proof of Creativity
          </div>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {['dashboard', 'bounties', 'market', 'governance'].map(t => (
            <button key={t} onClick={() => setTab(t)} style={TAB_STYLE(tab === t)}>{t}</button>
          ))}
        </div>
      </div>

      {/* ============ DASHBOARD ============ */}
      {tab === 'dashboard' && (
        <div>
          {/* Key metrics */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
            {[
              { label: 'Current Price', value: `${currentPrice.toFixed(6)} ETH`, color: '#ff6b35' },
              { label: 'Total Supply', value: `${totalProjectedSupply.toFixed(0)} $VERSE`, color: '#4ade80' },
              { label: 'Epoch', value: `${Math.max(...nodes.map(n => n.epoch || 0))}`, color: '#818cf8' },
              { label: 'Authors', value: `${authorStats.length}`, color: '#c8b6ff' },
            ].map(m => (
              <div key={m.label} style={{
                padding: '16px 20px', background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.06)', borderRadius: 6,
              }}>
                <div style={{ fontSize: 9, color: '#3a3550', letterSpacing: '0.15em', textTransform: 'uppercase' }}>{m.label}</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: m.color, marginTop: 4 }}>{m.value}</div>
              </div>
            ))}
          </div>

          {/* Bonding curve chart */}
          <div style={{
            padding: '20px', background: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.06)', borderRadius: 6, marginBottom: 24,
          }}>
            <div style={{ fontSize: 10, color: '#665f7a', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 12 }}>
              Bonding Curve — Price vs Supply
            </div>
            <svg viewBox="0 0 600 200" style={{ width: '100%', height: 200 }}>
              {/* Grid lines */}
              {[0, 50, 100, 150].map(y => (
                <line key={y} x1="50" y1={y + 10} x2="580" y2={y + 10} stroke="rgba(255,255,255,0.04)" />
              ))}
              {/* Curve */}
              <polyline
                points={curveData.map((p, i) => {
                  const x = 50 + (i / curveData.length) * 530;
                  const maxPrice = curveData[curveData.length - 1]?.price || 0.001;
                  const y = 170 - (p.price / maxPrice) * 150;
                  return `${x},${y}`;
                }).join(' ')}
                fill="none" stroke="#ff6b35" strokeWidth="2"
              />
              {/* Current position marker */}
              {(() => {
                const maxPrice = curveData[curveData.length - 1]?.price || 0.001;
                const maxSupply = curveData[curveData.length - 1]?.supply || 1;
                const cx = 50 + (totalProjectedSupply / maxSupply) * 530;
                const cy = 170 - (currentPrice / maxPrice) * 150;
                return (
                  <>
                    <circle cx={cx} cy={cy} r="5" fill="#ff6b35" />
                    <text x={cx + 10} y={cy - 5} fill="#ff6b35" fontSize="9" fontFamily="monospace">Now</text>
                  </>
                );
              })()}
              {/* Axis labels */}
              <text x="50" y="190" fill="#3a3550" fontSize="8" fontFamily="monospace">0</text>
              <text x="560" y="190" fill="#3a3550" fontSize="8" fontFamily="monospace">{(curveData[curveData.length - 1]?.supply || 0).toFixed(0)}</text>
              <text x="5" y="15" fill="#3a3550" fontSize="8" fontFamily="monospace">Price (ETH)</text>
              <text x="280" y="198" fill="#3a3550" fontSize="8" fontFamily="monospace" textAnchor="middle">Supply ($VERSE)</text>
            </svg>
          </div>

          {/* Author token allocation */}
          <div style={{
            padding: '20px', background: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.06)', borderRadius: 6,
          }}>
            <div style={{ fontSize: 10, color: '#665f7a', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 12 }}>
              Token Allocation by Author
            </div>
            {authorStats.map(a => (
              <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: a.color, flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 3 }}>
                    <span style={{ color: a.color, fontWeight: 600 }}>{a.name}</span>
                    <span style={{ color: '#ff6b35' }}>{(a.totalScore * 100).toFixed(0)} $VERSE</span>
                  </div>
                  <div style={{ height: 3, background: 'rgba(255,255,255,0.05)', borderRadius: 2 }}>
                    <div style={{
                      width: `${(a.totalScore / Math.max(...authorStats.map(x => x.totalScore))) * 100}%`,
                      height: '100%', background: a.color, borderRadius: 2,
                    }} />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Tokenomics summary */}
          <div style={{
            marginTop: 20, padding: '16px 20px', background: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.06)', borderRadius: 6,
            fontSize: 10, color: '#665f7a', lineHeight: 1.8,
          }}>
            <div style={{ fontWeight: 700, color: '#8a829e', marginBottom: 4, letterSpacing: '0.1em' }}>TOKENOMICS</div>
            <div><strong style={{ color: '#e8e4f0' }}>Supply:</strong> Bonding curve — price = {BASE_PRICE} + {SLOPE} &times; supply&sup2;</div>
            <div><strong style={{ color: '#e8e4f0' }}>Minting:</strong> Claim from influence scores (free) or buy on curve (ETH)</div>
            <div><strong style={{ color: '#e8e4f0' }}>Selling:</strong> Burn tokens, receive ETH back (5% spread)</div>
            <div><strong style={{ color: '#e8e4f0' }}>Rewards:</strong> &Delta;influence per epoch &times; 100 = $VERSE minted</div>
            <div><strong style={{ color: '#e8e4f0' }}>Revenue share:</strong> Propagates backward through verse:reuses edges</div>
            <div><strong style={{ color: '#e8e4f0' }}>Chain:</strong> Base Sepolia (testnet) — ERC-20 + Bonding Curve + Marketplace</div>
          </div>
        </div>
      )}

      {/* ============ BOUNTIES ============ */}
      {tab === 'bounties' && (
        <div>
          <div style={{ fontSize: 10, color: '#665f7a', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 16 }}>
            Bounty Board — {simulatedBounties.length} Open
          </div>
          {simulatedBounties.map((b, i) => (
            <div key={i} style={{
              padding: '14px 18px', marginBottom: 8,
              background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: 6, display: 'flex', alignItems: 'center', gap: 16,
            }}>
              <div style={{
                padding: '4px 10px', background: 'rgba(255,107,53,0.1)',
                border: '1px solid rgba(255,107,53,0.2)', borderRadius: 3,
                fontSize: 12, fontWeight: 700, color: '#ff6b35', minWidth: 70, textAlign: 'center',
              }}>
                {b.reward} $V
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, color: '#e8e4f0', fontWeight: 600 }}>
                  Create a {b.type} in {b.parentLabel}
                </div>
                <div style={{ fontSize: 10, color: '#3a3550', marginTop: 2 }}>
                  Parent: {b.parentId} &middot; Reward on completion
                </div>
              </div>
              <div style={{
                padding: '4px 10px', fontSize: 9, letterSpacing: '0.1em',
                background: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.2)',
                borderRadius: 3, color: '#4ade80', textTransform: 'uppercase',
              }}>
                {b.status}
              </div>
            </div>
          ))}
          <div style={{ marginTop: 16, fontSize: 10, color: '#3a3550', lineHeight: 1.6 }}>
            Bounties are staked on-chain. When someone creates a verse that extends the parent node
            with the required type, they can claim the reward. Unclaimed bounties expire and refund
            to the poster.
          </div>
        </div>
      )}

      {/* ============ IP MARKET ============ */}
      {tab === 'market' && (
        <div>
          <div style={{ fontSize: 10, color: '#665f7a', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 16 }}>
            Narrative IP Market
          </div>
          {nodes.filter(n => n.type === 'World' || scores[n.id]?.normalized > 0.3).map(n => {
            const sc = scores[n.id];
            const projectedValue = (sc?.total || 0) * 100;
            return (
              <div key={n.id} style={{
                padding: '14px 18px', marginBottom: 8,
                background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: 6, display: 'flex', alignItems: 'center', gap: 16,
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#e8e4f0' }}>{n.label}</span>
                    <span style={{ fontSize: 9, color: '#665f7a' }}>{n.type} &middot; {n.id}</span>
                  </div>
                  <div style={{ fontSize: 10, color: '#3a3550', marginTop: 2 }}>
                    Influence: {sc?.total?.toFixed(2) || 0} &middot; Descendants: {sc?.reuseCount || 0}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#ff6b35' }}>
                    {projectedValue.toFixed(0)} $V
                  </div>
                  <div style={{ fontSize: 9, color: '#3a3550' }}>
                    projected value
                  </div>
                </div>
                <div style={{
                  padding: '6px 12px', background: 'rgba(200,182,255,0.08)',
                  border: '1px solid rgba(200,182,255,0.15)', borderRadius: 4,
                  fontSize: 10, color: '#c8b6ff', cursor: 'pointer',
                }}>
                  Register
                </div>
              </div>
            );
          })}
          <div style={{
            marginTop: 16, padding: '16px 20px', background: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.06)', borderRadius: 6,
            fontSize: 10, color: '#665f7a', lineHeight: 1.8,
          }}>
            <div style={{ fontWeight: 700, color: '#8a829e', marginBottom: 4 }}>REVENUE SHARING</div>
            When a verse node is sold, royalties propagate backward through reuse edges.
            If "Ash on Glass" (which merges Pyro-Linguistics + Crystalline Memory) is sold,
            both parent node owners receive their configured royalty percentage. This creates
            a recursive revenue stream that rewards foundational creativity.
          </div>
        </div>
      )}

      {/* ============ GOVERNANCE ============ */}
      {tab === 'governance' && (
        <div>
          <div style={{ fontSize: 10, color: '#665f7a', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 16 }}>
            Governance — Protocol Parameters
          </div>

          {/* Current parameters */}
          <div style={{
            padding: '16px 20px', background: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.06)', borderRadius: 6, marginBottom: 16,
          }}>
            <div style={{ fontSize: 10, color: '#8a829e', fontWeight: 700, marginBottom: 8, letterSpacing: '0.1em' }}>
              CURRENT PARAMETERS
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 11, color: '#8a829e' }}>
              {[
                ['Fork Depth Weight', '0.25'],
                ['Structural Reuse Weight', '0.30'],
                ['Merge Centrality Weight', '0.25'],
                ['Novelty Delta Weight', '0.20'],
                ['Epoch Duration', 'Per commit'],
                ['Agent Max Proposals/Day', '2'],
                ['Bounty Expiry Default', '30 days'],
                ['Max Royalty Rate', '25%'],
              ].map(([k, v]) => (
                <div key={k} style={{
                  padding: '8px 12px', background: 'rgba(255,255,255,0.02)',
                  borderRadius: 4, display: 'flex', justifyContent: 'space-between',
                }}>
                  <span style={{ color: '#665f7a' }}>{k}</span>
                  <span style={{ color: '#e8e4f0', fontWeight: 600 }}>{v}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Sample proposals */}
          <div style={{ fontSize: 10, color: '#8a829e', fontWeight: 700, marginBottom: 8, letterSpacing: '0.1em' }}>
            PROPOSALS
          </div>
          {[
            { id: 1, title: 'Increase merge centrality weight to 0.35', author: 'markj', forVotes: 1200, againstVotes: 300, status: 'active' },
            { id: 2, title: 'Allow agents to submit merge proposals', author: 'verse-bot', forVotes: 800, againstVotes: 900, status: 'active' },
            { id: 3, title: 'Add "Cosmology" as a narrative type', author: 'markj', forVotes: 500, againstVotes: 50, status: 'passed' },
          ].map(p => {
            const total = p.forVotes + p.againstVotes;
            const forPct = total > 0 ? (p.forVotes / total * 100) : 0;
            return (
              <div key={p.id} style={{
                padding: '14px 18px', marginBottom: 8,
                background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: 6,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 12, color: '#e8e4f0', fontWeight: 600 }}>{p.title}</span>
                  <span style={{
                    fontSize: 9, padding: '2px 8px', borderRadius: 3,
                    background: p.status === 'passed' ? 'rgba(74,222,128,0.1)' : 'rgba(255,107,53,0.1)',
                    color: p.status === 'passed' ? '#4ade80' : '#ff6b35',
                    border: `1px solid ${p.status === 'passed' ? 'rgba(74,222,128,0.2)' : 'rgba(255,107,53,0.2)'}`,
                    textTransform: 'uppercase', letterSpacing: '0.1em',
                  }}>
                    {p.status}
                  </span>
                </div>
                <div style={{ fontSize: 10, color: '#3a3550', marginBottom: 8 }}>
                  Proposed by {p.author} &middot; {total.toLocaleString()} $VERSE voted
                </div>
                <div style={{ height: 4, background: 'rgba(255,255,255,0.05)', borderRadius: 2, display: 'flex', overflow: 'hidden' }}>
                  <div style={{ width: `${forPct}%`, background: '#4ade80', borderRadius: '2px 0 0 2px' }} />
                  <div style={{ width: `${100 - forPct}%`, background: '#f43f5e', borderRadius: '0 2px 2px 0' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, marginTop: 4, color: '#3a3550' }}>
                  <span style={{ color: '#4ade80' }}>For: {p.forVotes.toLocaleString()}</span>
                  <span style={{ color: '#f43f5e' }}>Against: {p.againstVotes.toLocaleString()}</span>
                </div>
              </div>
            );
          })}

          <div style={{
            marginTop: 16, padding: '12px 16px', background: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.06)', borderRadius: 6,
            fontSize: 10, color: '#3a3550', lineHeight: 1.6,
          }}>
            Requires 100 $VERSE to propose. Voting weight = $VERSE balance. 3-day voting period.
            Passed proposals are executed by the protocol maintainers.
          </div>
        </div>
      )}
    </div>
  );
}
