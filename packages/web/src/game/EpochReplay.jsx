import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { computeInfluence, TYPE_ICONS, RELATION_COLORS } from '@verse-protocol/core';

/**
 * Epoch Replay — watch the world grow epoch by epoch.
 *
 * A timeline scrubber that replays the DAG construction,
 * showing nodes appearing, edges forming, and influence
 * scores shifting in real-time.
 */

function layoutReplayDAG(nodes, W = 1000, H = 600) {
  const epochGroups = {};
  nodes.forEach(n => {
    const e = n.epoch || 0;
    if (!epochGroups[e]) epochGroups[e] = [];
    epochGroups[e].push(n.id);
  });

  const epochs = Object.keys(epochGroups).map(Number).sort((a, b) => a - b);
  const positions = {};

  epochs.forEach((ep, ei) => {
    const group = epochGroups[ep];
    const x = 60 + (ei / Math.max(epochs.length - 1, 1)) * (W - 120);
    group.forEach((id, gi) => {
      const spread = Math.min(group.length * 90, H - 100);
      const yStart = (H - spread) / 2;
      const y = yStart + (gi / Math.max(group.length - 1, 1)) * spread;
      positions[id] = { x, y: group.length === 1 ? H / 2 : y };
    });
  });

  return positions;
}

function influenceColor(normalized) {
  const r = Math.round(40 + normalized * 215);
  const g = Math.round(20 + (1 - normalized) * 60 + normalized * 80);
  const b = Math.round(60 + (1 - normalized) * 140);
  return `rgb(${r},${g},${b})`;
}

export default function EpochReplay({ allNodes, onClose }) {
  const [currentEpoch, setCurrentEpoch] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1500);
  const canvasRef = useRef(null);
  const intervalRef = useRef(null);

  const maxEpoch = useMemo(() =>
    Math.max(...allNodes.map(n => n.epoch || 0)),
    [allNodes]
  );

  // Nodes visible at current epoch
  const visibleNodes = useMemo(() =>
    allNodes.filter(n => (n.epoch || 0) <= currentEpoch),
    [allNodes, currentEpoch]
  );

  const positions = useMemo(() => layoutReplayDAG(allNodes), [allNodes]);
  const scores = useMemo(() => computeInfluence(visibleNodes), [visibleNodes]);

  // The newest node (just appeared)
  const newestNodes = useMemo(() =>
    allNodes.filter(n => (n.epoch || 0) === currentEpoch),
    [allNodes, currentEpoch]
  );

  // Playback
  useEffect(() => {
    if (playing) {
      intervalRef.current = setInterval(() => {
        setCurrentEpoch(prev => {
          if (prev >= maxEpoch) {
            setPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, speed);
    }
    return () => clearInterval(intervalRef.current);
  }, [playing, speed, maxEpoch]);

  // Canvas rendering
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const W = 1000, H = 600;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, W, H);

    // Draw edges
    for (const n of visibleNodes) {
      if (!n.parents) continue;
      for (const pid of n.parents) {
        const from = positions[pid];
        const to = positions[n.id];
        if (!from || !to) continue;

        const isNew = newestNodes.includes(n);
        const relColor = RELATION_COLORS[n.relation] || '#555';

        ctx.beginPath();
        ctx.strokeStyle = isNew ? relColor : `${relColor}66`;
        ctx.lineWidth = isNew ? 2.5 : 1;

        if (n.relation === 'merges') ctx.setLineDash([6, 4]);
        else if (n.relation === 'forks') ctx.setLineDash([3, 3]);
        else ctx.setLineDash([]);

        const cpX = (from.x + to.x) / 2;
        ctx.moveTo(from.x, from.y);
        ctx.bezierCurveTo(cpX, from.y, cpX, to.y, to.x, to.y);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    // Draw nodes
    for (const n of visibleNodes) {
      const pos = positions[n.id];
      if (!pos) continue;
      const sc = scores[n.id];
      const isNew = newestNodes.includes(n);
      const norm = sc?.normalized || 0;
      const size = 8 + norm * 14;

      // Glow for new nodes
      if (isNew) {
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, size + 10, 0, Math.PI * 2);
        const grad = ctx.createRadialGradient(pos.x, pos.y, size, pos.x, pos.y, size + 10);
        grad.addColorStop(0, 'rgba(255,107,53,0.3)');
        grad.addColorStop(1, 'rgba(255,107,53,0)');
        ctx.fillStyle = grad;
        ctx.fill();
      }

      // Node circle
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, size, 0, Math.PI * 2);
      ctx.fillStyle = influenceColor(norm);
      ctx.fill();
      ctx.strokeStyle = isNew ? '#fff' : 'rgba(255,255,255,0.15)';
      ctx.lineWidth = isNew ? 2 : 1;
      ctx.stroke();

      // Label
      ctx.fillStyle = isNew ? '#e8e4f0' : '#665f7a';
      ctx.font = `${isNew ? '11' : '9'}px "JetBrains Mono", monospace`;
      ctx.textAlign = 'center';
      ctx.fillText(n.label, pos.x, pos.y + size + 14);
    }
  }, [visibleNodes, positions, scores, newestNodes]);

  // Stats for current epoch
  const topNode = useMemo(() => {
    if (visibleNodes.length === 0) return null;
    return [...visibleNodes].sort((a, b) => (scores[b.id]?.total || 0) - (scores[a.id]?.total || 0))[0];
  }, [visibleNodes, scores]);

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      background: 'rgba(5,4,10,0.95)',
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Header */}
      <div style={{
        padding: '16px 24px', borderBottom: '1px solid rgba(255,255,255,0.06)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <div>
          <h2 style={{
            margin: 0, fontSize: 16, fontWeight: 700, color: '#ff6b35',
          }}>
            ◆ Epoch Replay
          </h2>
          <div style={{ fontSize: 10, color: '#3a3550', marginTop: 2 }}>
            Watch the multiverse grow
          </div>
        </div>
        <button onClick={onClose} style={{
          background: 'none', border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 4, padding: '6px 14px', cursor: 'pointer',
          color: '#665f7a', fontSize: 11, fontFamily: 'inherit',
        }}>
          Close
        </button>
      </div>

      {/* Canvas */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
        <canvas ref={canvasRef} style={{ width: 1000, height: 600 }} />

        {/* Epoch indicator */}
        <div style={{
          position: 'absolute', top: 20, left: '50%', transform: 'translateX(-50%)',
          padding: '8px 20px', background: 'rgba(255,107,53,0.1)',
          border: '1px solid rgba(255,107,53,0.2)', borderRadius: 6,
          textAlign: 'center',
        }}>
          <div style={{ fontSize: 9, color: '#665f7a', letterSpacing: '0.15em', textTransform: 'uppercase' }}>Epoch</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#ff6b35' }}>{currentEpoch}</div>
        </div>

        {/* New node announcement */}
        {newestNodes.length > 0 && currentEpoch > 0 && (
          <div style={{
            position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)',
            padding: '10px 20px', background: 'rgba(200,182,255,0.1)',
            border: '1px solid rgba(200,182,255,0.2)', borderRadius: 6,
            textAlign: 'center', maxWidth: 500,
          }}>
            {newestNodes.map(n => (
              <div key={n.id} style={{ marginBottom: 4 }}>
                <span style={{ color: '#c8b6ff', fontWeight: 600 }}>
                  {TYPE_ICONS[n.type]} {n.label}
                </span>
                <span style={{ color: '#665f7a', fontSize: 10, marginLeft: 8 }}>
                  {n.relation || 'origin'} · {n.type}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Stats sidebar */}
        <div style={{
          position: 'absolute', right: 20, top: 20, width: 200,
          background: 'rgba(15,12,25,0.8)', borderRadius: 6,
          padding: '12px 16px', border: '1px solid rgba(255,255,255,0.06)',
        }}>
          <div style={{ fontSize: 9, color: '#3a3550', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>Stats</div>
          <div style={{ fontSize: 11, color: '#8a829e', lineHeight: 2 }}>
            <div>Nodes: <span style={{ color: '#e8e4f0' }}>{visibleNodes.length}</span></div>
            <div>Types: <span style={{ color: '#e8e4f0' }}>{new Set(visibleNodes.map(n => n.type)).size}</span></div>
            {topNode && (
              <div>Top: <span style={{ color: '#ff6b35' }}>{topNode.label}</span></div>
            )}
            {topNode && scores[topNode.id] && (
              <div>Score: <span style={{ color: '#ff6b35' }}>{scores[topNode.id].total.toFixed(2)}</span></div>
            )}
          </div>
        </div>
      </div>

      {/* Controls */}
      <div style={{
        padding: '16px 24px', borderTop: '1px solid rgba(255,255,255,0.06)',
        display: 'flex', alignItems: 'center', gap: 16,
      }}>
        {/* Play/Pause */}
        <button onClick={() => {
          if (currentEpoch >= maxEpoch) setCurrentEpoch(0);
          setPlaying(!playing);
        }} style={{
          padding: '8px 20px', fontSize: 12, cursor: 'pointer',
          background: playing ? 'rgba(255,107,53,0.2)' : 'rgba(255,107,53,0.1)',
          border: '1px solid rgba(255,107,53,0.3)', borderRadius: 4,
          color: '#ff6b35', fontFamily: 'inherit', fontWeight: 600,
        }}>
          {playing ? '⏸ Pause' : currentEpoch >= maxEpoch ? '↺ Replay' : '▶ Play'}
        </button>

        {/* Timeline scrubber */}
        <input
          type="range"
          min={0}
          max={maxEpoch}
          value={currentEpoch}
          onChange={e => { setCurrentEpoch(parseInt(e.target.value, 10)); setPlaying(false); }}
          style={{ flex: 1, accentColor: '#ff6b35' }}
        />

        {/* Epoch label */}
        <span style={{ fontSize: 11, color: '#665f7a', minWidth: 80 }}>
          {currentEpoch} / {maxEpoch}
        </span>

        {/* Speed control */}
        <select
          value={speed}
          onChange={e => setSpeed(parseInt(e.target.value, 10))}
          style={{
            padding: '6px 10px', fontSize: 10,
            background: '#12101c', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 4, color: '#8a829e', fontFamily: 'inherit',
          }}
        >
          <option value={3000}>Slow</option>
          <option value={1500}>Normal</option>
          <option value={700}>Fast</option>
          <option value={300}>Warp</option>
        </select>
      </div>
    </div>
  );
}
