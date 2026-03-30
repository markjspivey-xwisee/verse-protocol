import { useState, useMemo, useEffect, useRef } from 'react';
import { computeAuthorStats } from '@verse-protocol/core';

/**
 * Economy View — Token dashboard, bounty board, IP market, governance.
 *
 * Reads real data from GitHub Issues API for bounties and governance.
 * Bonding curve simulated locally (matches VerseToken.sol math).
 * Smart contract integration planned for post-deployment.
 */

const REPO = 'markjspivey-xwisee/verse-protocol';
const CACHE_TTL = 5 * 60 * 1000;

// Bonding curve simulation (mirrors VerseToken.sol integral pricing)
const BASE_PRICE = 0.0001;
const SLOPE = 0.00000001;

function bondingCurvePrice(supply) {
  return BASE_PRICE + SLOPE * supply * supply;
}

function integralCost(s0, s1) {
  return BASE_PRICE * (s1 - s0) + SLOPE * (s1 * s1 * s1 - s0 * s0 * s0) / 3;
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

// Fetch GitHub issues with caching
function useGithubIssues(label, cacheKey) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const cacheRef = useRef({ data: null, ts: 0 });

  useEffect(() => {
    const now = Date.now();
    if (cacheRef.current.data && now - cacheRef.current.ts < CACHE_TTL) {
      setData(cacheRef.current.data);
      setLoading(false);
      return;
    }

    fetch(`https://api.github.com/repos/${REPO}/issues?labels=${encodeURIComponent(label)}&state=all&per_page=20&sort=created&direction=desc`)
      .then(r => r.ok ? r.json() : [])
      .then(issues => {
        cacheRef.current = { data: issues, ts: Date.now() };
        setData(issues);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [label]);

  return { data, loading };
}

export default function EconomyView({ nodes, scores, authors }) {
  const [tab, setTab] = useState('dashboard');

  const authorStats = useMemo(() =>
    computeAuthorStats(nodes, authors, scores),
    [nodes, authors, scores]
  );

  const totalProjectedSupply = useMemo(() =>
    Object.values(scores).reduce((sum, s) => sum + s.total * 100, 0),
    [scores]
  );

  const curveData = useMemo(() =>
    simulateBondingCurve(Math.max(totalProjectedSupply * 2, 10000)),
    [totalProjectedSupply]
  );

  const currentPrice = bondingCurvePrice(totalProjectedSupply);
  const marketCap = integralCost(0, totalProjectedSupply);

  // Real bounty-related issues from GitHub
  const { data: bountyIssues, loading: bountiesLoading } = useGithubIssues('verse-proposal', 'bounties');

  // Real governance-related issues (we'll use a "governance" label)
  const { data: govIssues, loading: govLoading } = useGithubIssues('governance', 'governance');

  // Detect affordances for the bounty board
  const affordanceBounties = useMemo(() => {
    const childTypeMap = {};
    for (const n of nodes) childTypeMap[n.id] = new Set();
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
      if ((n.type === 'World' || n.type === 'Location') && !ct.has('Location'))
        bounties.push({ parentId: n.id, parentLabel: n.label, type: 'Location', reward: 50, desc: `Discover a location within ${n.label}` });
      if ((n.type === 'Location' || n.type === 'Faction') && !ct.has('Character'))
        bounties.push({ parentId: n.id, parentLabel: n.label, type: 'Character', reward: 30, desc: `Create a character in ${n.label}` });
      if ((n.type === 'Character' || n.type === 'Event') && !ct.has('Verse') && !ct.has('Event'))
        bounties.push({ parentId: n.id, parentLabel: n.label, type: 'Verse', reward: 20, desc: `Continue ${n.label}'s story` });
    }
    return bounties;
  }, [nodes]);

  function openBountyProposal(bounty) {
    const title = encodeURIComponent(`[Extend] ${bounty.type} in ${bounty.parentLabel}`);
    window.open(`https://github.com/${REPO}/issues/new?template=verse-extend.yml&title=${title}&labels=verse-proposal,extend`, '_blank');
  }

  function openGovernanceProposal() {
    window.open(`https://github.com/${REPO}/issues/new?title=${encodeURIComponent('[Governance] ')}&labels=governance&body=${encodeURIComponent('## Proposal\n\nDescribe your proposed change to the Verse Protocol parameters.\n\n## Rationale\n\nWhy should this change be made?\n\n## Impact\n\nWhat would change if this passes?')}`, '_blank');
  }

  function openNodeRegistration(node) {
    window.open(`https://github.com/${REPO}/issues/new?title=${encodeURIComponent(`[Register] ${node.label} (${node.id})`)}&labels=ip-registration&body=${encodeURIComponent(`### Node\n\n${node.id} — ${node.label}\n\n### Owner Address\n\n0x...\n\n### Royalty Rate\n\n10%`)}`, '_blank');
  }

  return (
    <div style={{ padding: '16px', maxWidth: 1000, margin: '0 auto', overflowY: 'auto', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#ff6b35' }}>$VERSE Economy</h2>
          <div style={{ fontSize: 10, color: '#3a3550', marginTop: 2 }}>
            Bonding curve &middot; Base Sepolia &middot; Proof of Creativity
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
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 24 }}>
            {[
              { label: 'Current Price', value: `${currentPrice.toFixed(6)} ETH`, color: '#ff6b35' },
              { label: 'Projected Supply', value: `${totalProjectedSupply.toFixed(0)} $VERSE`, color: '#4ade80' },
              { label: 'Market Cap', value: `${marketCap.toFixed(4)} ETH`, color: '#818cf8' },
              { label: 'Active Authors', value: `${authorStats.length}`, color: '#c8b6ff' },
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

          {/* Bonding curve SVG */}
          <div style={{
            padding: '20px', background: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.06)', borderRadius: 6, marginBottom: 24,
          }}>
            <div style={{ fontSize: 10, color: '#665f7a', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 12 }}>
              Bonding Curve &mdash; Price vs Supply (integral pricing)
            </div>
            <svg viewBox="0 0 600 200" style={{ width: '100%', height: 200 }}>
              {[0, 50, 100, 150].map(y => (
                <line key={y} x1="50" y1={y + 10} x2="580" y2={y + 10} stroke="rgba(255,255,255,0.04)" />
              ))}
              <polyline
                points={curveData.map((p, i) => {
                  const x = 50 + (i / curveData.length) * 530;
                  const maxP = curveData[curveData.length - 1]?.price || 0.001;
                  const y = 170 - (p.price / maxP) * 150;
                  return `${x},${y}`;
                }).join(' ')}
                fill="none" stroke="#ff6b35" strokeWidth="2"
              />
              {/* Fill area under curve */}
              <polygon
                points={`50,170 ${curveData.map((p, i) => {
                  const x = 50 + (i / curveData.length) * 530;
                  const maxP = curveData[curveData.length - 1]?.price || 0.001;
                  const y = 170 - (p.price / maxP) * 150;
                  return `${x},${y}`;
                }).join(' ')} 580,170`}
                fill="rgba(255,107,53,0.08)"
              />
              {(() => {
                const maxP = curveData[curveData.length - 1]?.price || 0.001;
                const maxS = curveData[curveData.length - 1]?.supply || 1;
                const cx = 50 + (totalProjectedSupply / maxS) * 530;
                const cy = 170 - (currentPrice / maxP) * 150;
                return <>
                  <line x1={cx} y1={10} x2={cx} y2={170} stroke="rgba(255,107,53,0.3)" strokeDasharray="4 4" />
                  <circle cx={cx} cy={cy} r="5" fill="#ff6b35" />
                  <text x={cx + 10} y={cy - 5} fill="#ff6b35" fontSize="9" fontFamily="monospace">You are here</text>
                </>;
              })()}
              <text x="5" y="15" fill="#3a3550" fontSize="8" fontFamily="monospace">Price (ETH)</text>
              <text x="280" y="198" fill="#3a3550" fontSize="8" fontFamily="monospace" textAnchor="middle">Supply ($VERSE)</text>
            </svg>
          </div>

          {/* Author allocation */}
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
                      width: `${(a.totalScore / Math.max(...authorStats.map(x => x.totalScore), 0.001)) * 100}%`,
                      height: '100%', background: a.color, borderRadius: 2,
                    }} />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Tokenomics explainer */}
          <div style={{
            marginTop: 20, padding: '16px 20px', background: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.06)', borderRadius: 6,
            fontSize: 10, color: '#665f7a', lineHeight: 1.8,
          }}>
            <div style={{ fontWeight: 700, color: '#8a829e', marginBottom: 4, letterSpacing: '0.1em' }}>TOKENOMICS</div>
            <div><strong style={{ color: '#e8e4f0' }}>Supply:</strong> Bonding curve &mdash; price = {BASE_PRICE} + {SLOPE} &times; supply&sup2;</div>
            <div><strong style={{ color: '#e8e4f0' }}>Buy:</strong> ETH &rarr; $VERSE (integral pricing, slippage protected)</div>
            <div><strong style={{ color: '#e8e4f0' }}>Sell:</strong> $VERSE &rarr; ETH (5% spread, reentrancy guarded)</div>
            <div><strong style={{ color: '#e8e4f0' }}>Claim:</strong> Free mint from influence scores (Merkle proof, capped 100k/epoch)</div>
            <div><strong style={{ color: '#e8e4f0' }}>Revenue:</strong> Royalties propagate backward through verse:reuses edges (max 25%)</div>
            <div><strong style={{ color: '#e8e4f0' }}>Status:</strong> Contracts compiled &amp; tested. Deploy: <code style={{ color: '#ff6b35' }}>npx hardhat run scripts/deploy.js --network baseSepolia</code></div>
          </div>
        </div>
      )}

      {/* ============ BOUNTIES ============ */}
      {tab === 'bounties' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ fontSize: 10, color: '#665f7a', letterSpacing: '0.15em', textTransform: 'uppercase' }}>
              Bounty Board &mdash; {affordanceBounties.length} Open Affordances
            </div>
          </div>

          {affordanceBounties.map((b, i) => (
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
                <div style={{ fontSize: 12, color: '#e8e4f0', fontWeight: 600 }}>{b.desc}</div>
                <div style={{ fontSize: 10, color: '#3a3550', marginTop: 2 }}>
                  Parent: {b.parentId} &middot; Type needed: {b.type}
                </div>
              </div>
              <button onClick={() => openBountyProposal(b)} style={{
                padding: '6px 14px', fontSize: 10, cursor: 'pointer',
                background: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.2)',
                borderRadius: 4, color: '#4ade80', fontFamily: 'inherit', fontWeight: 600,
              }}>
                Claim &rarr;
              </button>
            </div>
          ))}

          {/* Recent proposals (real from GitHub) */}
          <div style={{ marginTop: 24 }}>
            <div style={{ fontSize: 10, color: '#665f7a', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 8 }}>
              Recent Claims &amp; Proposals
            </div>
            {bountiesLoading ? (
              <div style={{ fontSize: 10, color: '#3a3550' }}>Loading from GitHub...</div>
            ) : bountyIssues.length === 0 ? (
              <div style={{ fontSize: 10, color: '#3a3550' }}>No proposals yet. Be the first!</div>
            ) : bountyIssues.slice(0, 8).map(issue => (
              <a key={issue.id} href={issue.html_url} target="_blank" rel="noopener noreferrer" style={{
                display: 'block', padding: '8px 14px', marginBottom: 4,
                background: 'rgba(255,255,255,0.02)', borderRadius: 4,
                fontSize: 10, color: '#8a829e', textDecoration: 'none',
                border: '1px solid rgba(255,255,255,0.04)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{
                    width: 6, height: 6, borderRadius: '50%',
                    background: issue.state === 'open' ? '#f59e0b' : '#4ade80',
                  }} />
                  <span style={{ color: '#a098b4', fontWeight: 600 }}>
                    {issue.title.replace(/^\[(Extend|Fork|Merge)\]\s*/, '')}
                  </span>
                  <span style={{ marginLeft: 'auto', color: '#3a3550' }}>
                    @{issue.user.login} &middot; {issue.state === 'open' ? 'pending' : 'completed'}
                  </span>
                </div>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* ============ IP MARKET ============ */}
      {tab === 'market' && (
        <div>
          <div style={{ fontSize: 10, color: '#665f7a', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 16 }}>
            Narrative IP Market &mdash; {nodes.length} Verses
          </div>
          {[...nodes]
            .sort((a, b) => (scores[b.id]?.total || 0) - (scores[a.id]?.total || 0))
            .filter(n => scores[n.id]?.total > 0)
            .map(n => {
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
                      Influence: {sc?.total?.toFixed(2)} &middot; Reuse: {sc?.reuseCount || 0} &middot; Depth: {sc?.forkDepth || 0}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', marginRight: 8 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#ff6b35' }}>{projectedValue.toFixed(0)} $V</div>
                    <div style={{ fontSize: 9, color: '#3a3550' }}>projected value</div>
                  </div>
                  <button onClick={() => openNodeRegistration(n)} style={{
                    padding: '6px 14px', fontSize: 10, cursor: 'pointer',
                    background: 'rgba(200,182,255,0.08)', border: '1px solid rgba(200,182,255,0.15)',
                    borderRadius: 4, color: '#c8b6ff', fontFamily: 'inherit',
                  }}>
                    Register &rarr;
                  </button>
                </div>
              );
            })}

          <div style={{
            marginTop: 16, padding: '16px 20px', background: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.06)', borderRadius: 6,
            fontSize: 10, color: '#665f7a', lineHeight: 1.8,
          }}>
            <div style={{ fontWeight: 700, color: '#8a829e', marginBottom: 4 }}>HOW IP TRADING WORKS</div>
            <div>1. <strong style={{ color: '#e8e4f0' }}>Register</strong> &mdash; claim ownership of a verse node you authored (verified via registrar)</div>
            <div>2. <strong style={{ color: '#e8e4f0' }}>List</strong> &mdash; set a price in $VERSE (on-chain, post-deployment)</div>
            <div>3. <strong style={{ color: '#e8e4f0' }}>Sell</strong> &mdash; buyer pays, royalty flows to original creator (max 25%)</div>
            <div>4. <strong style={{ color: '#e8e4f0' }}>Earn</strong> &mdash; descendants of your node generate ongoing influence rewards</div>
          </div>
        </div>
      )}

      {/* ============ GOVERNANCE ============ */}
      {tab === 'governance' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ fontSize: 10, color: '#665f7a', letterSpacing: '0.15em', textTransform: 'uppercase' }}>
              Governance &mdash; Protocol Parameters
            </div>
            <button onClick={openGovernanceProposal} style={{
              padding: '6px 14px', fontSize: 10, cursor: 'pointer',
              background: 'rgba(255,107,53,0.1)', border: '1px solid rgba(255,107,53,0.25)',
              borderRadius: 4, color: '#ff6b35', fontFamily: 'inherit', fontWeight: 600,
            }}>
              + New Proposal
            </button>
          </div>

          {/* Current parameters */}
          <div style={{
            padding: '16px 20px', background: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.06)', borderRadius: 6, marginBottom: 16,
          }}>
            <div style={{ fontSize: 10, color: '#8a829e', fontWeight: 700, marginBottom: 8, letterSpacing: '0.1em' }}>CURRENT PARAMETERS</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 8, fontSize: 11, color: '#8a829e' }}>
              {[
                ['Fork Depth Weight', '0.25'],
                ['Structural Reuse Weight', '0.30'],
                ['Merge Centrality Weight', '0.25'],
                ['Novelty Delta Weight', '0.20'],
                ['Max Claim / Epoch', '100,000 $VERSE'],
                ['Agent Max Proposals/Day', '2'],
                ['Governance Quorum', '1,000 $VERSE'],
                ['Voting Period', '3 days'],
                ['Proposal Cooldown', '1 day'],
                ['Max Royalty Rate', '25%'],
                ['Sell Spread', '5%'],
                ['Proposal Threshold', '100 $VERSE'],
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

          {/* Real proposals from GitHub */}
          <div style={{ fontSize: 10, color: '#8a829e', fontWeight: 700, marginBottom: 8, letterSpacing: '0.1em' }}>
            PROPOSALS {govLoading ? '(loading...)' : `(${govIssues.length})`}
          </div>

          {!govLoading && govIssues.length === 0 && (
            <div style={{
              padding: '20px', background: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(255,255,255,0.06)', borderRadius: 6,
              fontSize: 11, color: '#3a3550', textAlign: 'center',
            }}>
              No governance proposals yet. Click "+ New Proposal" to create one.
              <div style={{ marginTop: 8, fontSize: 9, color: '#2a2540' }}>
                Proposals are submitted as GitHub Issues. Post-deployment, voting happens on-chain with $VERSE.
              </div>
            </div>
          )}

          {govIssues.map(issue => {
            const reactions = issue.reactions || {};
            const forVotes = (reactions['+1'] || 0) + (reactions.heart || 0) + (reactions.rocket || 0);
            const againstVotes = (reactions['-1'] || 0) + (reactions.confused || 0);
            const totalVotes = forVotes + againstVotes;
            const forPct = totalVotes > 0 ? (forVotes / totalVotes * 100) : 50;
            const isPassed = issue.state === 'closed' && forVotes > againstVotes;

            return (
              <a key={issue.id} href={issue.html_url} target="_blank" rel="noopener noreferrer" style={{
                display: 'block', padding: '14px 18px', marginBottom: 8,
                background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: 6, textDecoration: 'none',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 12, color: '#e8e4f0', fontWeight: 600 }}>
                    {issue.title.replace(/^\[Governance\]\s*/, '')}
                  </span>
                  <span style={{
                    fontSize: 9, padding: '2px 8px', borderRadius: 3,
                    background: isPassed ? 'rgba(74,222,128,0.1)' : issue.state === 'open' ? 'rgba(255,107,53,0.1)' : 'rgba(255,255,255,0.05)',
                    color: isPassed ? '#4ade80' : issue.state === 'open' ? '#ff6b35' : '#665f7a',
                    border: `1px solid ${isPassed ? 'rgba(74,222,128,0.2)' : issue.state === 'open' ? 'rgba(255,107,53,0.2)' : 'rgba(255,255,255,0.06)'}`,
                    textTransform: 'uppercase', letterSpacing: '0.1em',
                  }}>
                    {isPassed ? 'passed' : issue.state}
                  </span>
                </div>
                <div style={{ fontSize: 10, color: '#3a3550', marginBottom: 8 }}>
                  by @{issue.user.login} &middot; {totalVotes > 0 ? `${totalVotes} reactions` : 'no votes yet'} &middot; react with thumbs to vote
                </div>
                {totalVotes > 0 && (
                  <div style={{ height: 4, background: 'rgba(255,255,255,0.05)', borderRadius: 2, display: 'flex', overflow: 'hidden' }}>
                    <div style={{ width: `${forPct}%`, background: '#4ade80', borderRadius: '2px 0 0 2px' }} />
                    <div style={{ width: `${100 - forPct}%`, background: '#f43f5e', borderRadius: '0 2px 2px 0' }} />
                  </div>
                )}
              </a>
            );
          })}

          <div style={{
            marginTop: 16, padding: '12px 16px', background: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.06)', borderRadius: 6,
            fontSize: 10, color: '#3a3550', lineHeight: 1.6,
          }}>
            <strong style={{ color: '#665f7a' }}>How governance works:</strong> Proposals are GitHub Issues labeled "governance".
            Vote with reactions (thumbs up = for, thumbs down = against).
            Post-deployment, voting moves on-chain: 100 $VERSE to propose, 1000 $VERSE quorum, 3-day voting period.
          </div>
        </div>
      )}
    </div>
  );
}
