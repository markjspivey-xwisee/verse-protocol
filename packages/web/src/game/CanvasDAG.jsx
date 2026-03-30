import { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { prepareWithSegments, layoutWithLines } from '@chenglou/pretext';
import { computeInfluence, TYPE_ICONS, RELATION_COLORS } from '@verse-protocol/core';

/**
 * Pure canvas DAG renderer powered by Pretext for text layout.
 *
 * Zero DOM nodes for the graph — all rendering is canvas.
 * Supports pan/zoom via mouse and touch gestures.
 * Hit-testing via spatial index for node clicks/hovers.
 */

// --- Layout ---
// Lays out into a fixed "world space" large enough that nodes never overlap,
// then we fit-zoom the camera to show everything.
const WORLD_W = 2400;
const WORLD_H = 1800;
const NODE_SPACING_Y = 120; // Minimum vertical gap between nodes in same epoch

function layoutDAG(nodes) {
  const epochGroups = {};
  nodes.forEach(n => {
    const e = n.epoch || 0;
    if (!epochGroups[e]) epochGroups[e] = [];
    epochGroups[e].push(n.id);
  });
  const epochs = Object.keys(epochGroups).map(Number).sort((a, b) => a - b);
  const positions = {};
  const pad = 100;

  epochs.forEach((ep, ei) => {
    const group = epochGroups[ep];
    const x = pad + (ei / Math.max(epochs.length - 1, 1)) * (WORLD_W - pad * 2);
    const totalSpread = group.length * NODE_SPACING_Y;
    const yStart = (WORLD_H - totalSpread) / 2 + NODE_SPACING_Y / 2;
    group.forEach((id, gi) => {
      const y = group.length === 1 ? WORLD_H / 2 : yStart + gi * NODE_SPACING_Y;
      positions[id] = { x, y };
    });
  });
  return positions;
}

// Compute the zoom level that fits all nodes into the viewport with padding
function fitZoom(positions, viewW, viewH) {
  if (Object.keys(positions).length === 0) return { zoom: 1, cx: 0, cy: 0 };
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const { x, y } of Object.values(positions)) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  const contentW = maxX - minX + 200; // padding for node radius + labels
  const contentH = maxY - minY + 200;
  const zoom = Math.min(viewW / contentW, viewH / contentH, 1.5);
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  return { zoom: Math.max(0.15, zoom), cx, cy };
}

function influenceColor(normalized) {
  const r = Math.round(40 + normalized * 215);
  const g = Math.round(20 + (1 - normalized) * 60 + normalized * 80);
  const b = Math.round(60 + (1 - normalized) * 140);
  return `rgb(${r},${g},${b})`;
}

// --- Pretext label cache ---
const labelCache = new Map();

function getLabel(text, font, maxWidth) {
  const key = `${text}|${font}|${maxWidth}`;
  if (labelCache.has(key)) return labelCache.get(key);
  try {
    const prepared = prepareWithSegments(text, font);
    const result = layoutWithLines(prepared, maxWidth, 1.3);
    labelCache.set(key, result);
    return result;
  } catch {
    // Fallback if pretext fails
    return { lines: [{ text, width: maxWidth }], height: 14, lineCount: 1 };
  }
}

// --- Hit test ---
function hitTest(x, y, nodes, positions, scores) {
  for (const n of nodes) {
    const pos = positions[n.id];
    if (!pos) continue;
    const sc = scores[n.id];
    const size = 16 + (sc?.normalized || 0) * 20;
    const dx = x - pos.x;
    const dy = y - pos.y;
    if (dx * dx + dy * dy <= (size + 4) * (size + 4)) {
      return n.id;
    }
  }
  return null;
}

export default function CanvasDAG({ nodes, scores, authors, selected, onSelect, onHover }) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [size, setSize] = useState({ w: 800, h: 600 });

  // Pan/zoom state
  const [camera, setCamera] = useState({ x: 0, y: 0, zoom: 1 });
  const [hasAutoFit, setHasAutoFit] = useState(false);
  const dragRef = useRef({ dragging: false, lastX: 0, lastY: 0, startX: 0, startY: 0 });
  const touchRef = useRef({ pinching: false, lastDist: 0 });

  const positions = useMemo(() => layoutDAG(nodes), [nodes]);

  // Auto-fit camera when size is first known
  useEffect(() => {
    if (size.w > 100 && size.h > 100 && !hasAutoFit && Object.keys(positions).length > 0) {
      const { zoom, cx, cy } = fitZoom(positions, size.w, size.h);
      setCamera({
        x: -(cx - WORLD_W / 2),
        y: -(cy - WORLD_H / 2),
        zoom,
      });
      setHasAutoFit(true);
    }
  }, [size, positions, hasAutoFit]);

  // Resize observer
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect;
      if (width > 0 && height > 0) setSize({ w: width, h: height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // --- Render ---
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    canvas.width = size.w * dpr;
    canvas.height = size.h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size.w, size.h);

    // Apply camera transform: center on world, then pan/zoom
    ctx.save();
    ctx.translate(size.w / 2, size.h / 2);
    ctx.scale(camera.zoom, camera.zoom);
    ctx.translate(-WORLD_W / 2 + camera.x, -WORLD_H / 2 + camera.y);

    const labelFont = '9px "JetBrains Mono", monospace';
    const epochFont = '8px "JetBrains Mono", monospace';

    // --- Draw edges ---
    for (const n of nodes) {
      if (!n.parents) continue;
      for (const pid of n.parents) {
        const from = positions[pid];
        const to = positions[n.id];
        if (!from || !to) continue;

        const relColor = RELATION_COLORS[n.relation] || '#555';
        const isHighlighted = selected === n.id || selected === pid;

        ctx.beginPath();
        ctx.strokeStyle = isHighlighted ? relColor : `${relColor}55`;
        ctx.lineWidth = isHighlighted ? 2.5 / camera.zoom : 1.2 / camera.zoom;

        if (n.relation === 'merges') ctx.setLineDash([6, 4]);
        else if (n.relation === 'forks') ctx.setLineDash([3, 3]);
        else if (n.relation === 'redefines') ctx.setLineDash([8, 3, 2, 3]);
        else ctx.setLineDash([]);

        const cpX = (from.x + to.x) / 2;
        ctx.moveTo(from.x, from.y);
        ctx.bezierCurveTo(cpX, from.y, cpX, to.y, to.x, to.y);
        ctx.stroke();
        ctx.setLineDash([]);

        // Arrowhead
        const angle = Math.atan2(to.y - to.y, to.x - cpX) || 0;
        const arrowSize = 5 / camera.zoom;
        const ax = to.x - 14 / camera.zoom * Math.cos(angle);
        const ay = to.y - 14 / camera.zoom * Math.sin(angle);
        ctx.beginPath();
        ctx.fillStyle = isHighlighted ? relColor : `${relColor}55`;
        ctx.moveTo(to.x - 12 / camera.zoom * Math.cos(angle), to.y - 12 / camera.zoom * Math.sin(angle));
        ctx.lineTo(ax - arrowSize * Math.cos(angle - Math.PI / 2), ay - arrowSize * Math.sin(angle - Math.PI / 2));
        ctx.lineTo(ax + arrowSize * Math.cos(angle - Math.PI / 2), ay + arrowSize * Math.sin(angle - Math.PI / 2));
        ctx.closePath();
        ctx.fill();
      }
    }

    // --- Draw nodes ---
    const selectedNode = nodes.find(n => n.id === selected);

    for (const n of nodes) {
      const pos = positions[n.id];
      if (!pos) continue;
      const sc = scores[n.id];
      const norm = sc?.normalized || 0;
      const nodeSize = 16 + norm * 20;
      const isSelected = selected === n.id;
      const isParentOfSelected = selectedNode?.parents?.includes(n.id);
      const isChildOfSelected = n.parents?.includes(selected);
      const dimmed = selected && !isSelected && !isParentOfSelected && !isChildOfSelected;
      const author = authors[n.author || n.githubAuthor];

      ctx.globalAlpha = dimmed ? 0.2 : 1;

      // Glow
      if (norm > 0.3 && !dimmed) {
        const grad = ctx.createRadialGradient(pos.x, pos.y, nodeSize, pos.x, pos.y, nodeSize + 15);
        grad.addColorStop(0, `rgba(255,100,50,${norm * 0.3})`);
        grad.addColorStop(1, 'rgba(255,100,50,0)');
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, nodeSize + 15, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();
      }

      // Node body
      ctx.beginPath();
      if (n.type === 'World') {
        // Rounded square for worlds
        const s = nodeSize;
        const r = 6;
        ctx.moveTo(pos.x - s + r, pos.y - s);
        ctx.arcTo(pos.x + s, pos.y - s, pos.x + s, pos.y + s, r);
        ctx.arcTo(pos.x + s, pos.y + s, pos.x - s, pos.y + s, r);
        ctx.arcTo(pos.x - s, pos.y + s, pos.x - s, pos.y - s, r);
        ctx.arcTo(pos.x - s, pos.y - s, pos.x + s, pos.y - s, r);
        ctx.closePath();
      } else {
        ctx.arc(pos.x, pos.y, nodeSize, 0, Math.PI * 2);
      }

      const nodeColor = influenceColor(norm);
      const grad = ctx.createRadialGradient(pos.x - nodeSize * 0.2, pos.y - nodeSize * 0.2, 0, pos.x, pos.y, nodeSize);
      grad.addColorStop(0, nodeColor);
      grad.addColorStop(1, 'rgba(15,12,25,0.9)');
      ctx.fillStyle = grad;
      ctx.fill();

      ctx.strokeStyle = isSelected ? '#fff' : (author?.color || 'rgba(255,255,255,0.15)');
      ctx.lineWidth = isSelected ? 2 : 1;
      ctx.stroke();

      // Type icon
      const icon = TYPE_ICONS[n.type] || '●';
      ctx.font = `${nodeSize * 0.55}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = dimmed ? 'rgba(255,255,255,0.3)' : '#e8e4f0';
      ctx.fillText(icon, pos.x, pos.y);

      // Label (using pretext for measurement)
      const maxLabelWidth = 90;
      const label = getLabel(n.label, labelFont, maxLabelWidth);
      ctx.font = labelFont;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillStyle = dimmed ? 'rgba(255,255,255,0.1)' : '#a098b4';

      const labelY = pos.y + nodeSize + 5;
      if (label.lines) {
        label.lines.forEach((line, li) => {
          ctx.fillText(line.text || line, pos.x, labelY + li * 12);
        });
      }

      ctx.globalAlpha = 1;
    }

    // --- Epoch labels along bottom ---
    const epochSet = [...new Set(nodes.map(n => n.epoch))].sort((a, b) => a - b);
    ctx.font = epochFont;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillStyle = '#3a3550';
    for (let i = 0; i < epochSet.length; i++) {
      const ep = epochSet[i];
      const sampleNode = nodes.find(n => n.epoch === ep);
      if (sampleNode && positions[sampleNode.id]) {
        ctx.fillText(`E${ep}`, positions[sampleNode.id].x, WORLD_H - 20);
      }
    }

    // --- Legend ---
    ctx.restore(); // Reset camera for overlay elements

    const legendX = 12;
    let legendY = size.h - 80;
    ctx.font = '9px "JetBrains Mono", monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';

    for (const [rel, col] of Object.entries(RELATION_COLORS)) {
      if (!['extends', 'forks', 'merges', 'redefines', 'references'].includes(rel)) continue;
      ctx.beginPath();
      ctx.strokeStyle = col;
      ctx.lineWidth = 2;
      ctx.moveTo(legendX, legendY);
      ctx.lineTo(legendX + 16, legendY);
      ctx.stroke();
      ctx.fillStyle = '#8a829e';
      ctx.fillText(rel, legendX + 22, legendY);
      legendY += 14;
    }

  }, [nodes, positions, scores, selected, camera, size, authors]);

  // --- Mouse interaction ---
  const toWorld = useCallback((clientX, clientY) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    const sx = clientX - rect.left;
    const sy = clientY - rect.top;
    const wx = (sx - size.w / 2) / camera.zoom + WORLD_W / 2 - camera.x;
    const wy = (sy - size.h / 2) / camera.zoom + WORLD_H / 2 - camera.y;
    return { x: wx, y: wy };
  }, [camera, size]);

  const handleMouseDown = useCallback((e) => {
    dragRef.current = { dragging: true, lastX: e.clientX, lastY: e.clientY, startX: e.clientX, startY: e.clientY };
  }, []);

  const handleMouseMove = useCallback((e) => {
    const { x, y } = toWorld(e.clientX, e.clientY);
    const hit = hitTest(x, y, nodes, positions, scores);
    onHover(hit);
    canvasRef.current.style.cursor = hit ? 'pointer' : 'grab';

    if (dragRef.current.dragging) {
      const dx = (e.clientX - dragRef.current.lastX) / camera.zoom;
      const dy = (e.clientY - dragRef.current.lastY) / camera.zoom;
      setCamera(c => ({ ...c, x: c.x + dx, y: c.y + dy }));
      dragRef.current.lastX = e.clientX;
      dragRef.current.lastY = e.clientY;
      canvasRef.current.style.cursor = 'grabbing';
    }
  }, [toWorld, nodes, positions, scores, camera.zoom, onHover]);

  const handleMouseUp = useCallback((e) => {
    if (dragRef.current.dragging) {
      const moved = Math.abs(e.clientX - dragRef.current.startX) + Math.abs(e.clientY - dragRef.current.startY);
      if (moved < 8) {
        // Click, not drag
        const { x, y } = toWorld(e.clientX, e.clientY);
        const hit = hitTest(x, y, nodes, positions, scores);
        onSelect(hit === selected ? null : hit);
      }
    }
    dragRef.current.dragging = false;
  }, [toWorld, nodes, positions, scores, selected, onSelect]);

  const handleWheel = useCallback((e) => {
    e.preventDefault();
    const factor = e.deltaY > 0 ? 0.9 : 1.1;
    setCamera(c => ({
      ...c,
      zoom: Math.max(0.3, Math.min(5, c.zoom * factor)),
    }));
  }, []);

  // --- Touch interaction ---
  const handleTouchStart = useCallback((e) => {
    if (e.touches.length === 1) {
      const t = e.touches[0];
      dragRef.current = { dragging: true, lastX: t.clientX, lastY: t.clientY };
    } else if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      touchRef.current = { pinching: true, lastDist: Math.sqrt(dx * dx + dy * dy) };
      dragRef.current.dragging = false;
    }
  }, []);

  const handleTouchMove = useCallback((e) => {
    e.preventDefault();
    if (e.touches.length === 1 && dragRef.current.dragging) {
      const t = e.touches[0];
      const dx = (t.clientX - dragRef.current.lastX) / camera.zoom;
      const dy = (t.clientY - dragRef.current.lastY) / camera.zoom;
      setCamera(c => ({ ...c, x: c.x + dx, y: c.y + dy }));
      dragRef.current.lastX = t.clientX;
      dragRef.current.lastY = t.clientY;
    } else if (e.touches.length === 2 && touchRef.current.pinching) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const factor = dist / touchRef.current.lastDist;
      setCamera(c => ({ ...c, zoom: Math.max(0.3, Math.min(5, c.zoom * factor)) }));
      touchRef.current.lastDist = dist;
    }
  }, [camera.zoom]);

  const handleTouchEnd = useCallback((e) => {
    if (e.touches.length === 0) {
      if (dragRef.current.dragging) {
        // Tap detection
        const { x, y } = toWorld(dragRef.current.lastX, dragRef.current.lastY);
        const hit = hitTest(x, y, nodes, positions, scores);
        if (hit) onSelect(hit === selected ? null : hit);
      }
      dragRef.current.dragging = false;
      touchRef.current.pinching = false;
    }
  }, [toWorld, nodes, positions, scores, selected, onSelect]);

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'relative', touchAction: 'none' }}>
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: '100%', cursor: 'grab' }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => { dragRef.current.dragging = false; onHover(null); }}
        onWheel={handleWheel}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      />
      {/* Zoom indicator */}
      <div style={{
        position: 'absolute', bottom: 8, right: 8,
        fontSize: 9, color: '#3a3550', fontFamily: 'monospace',
        background: 'rgba(10,8,18,0.6)', padding: '2px 6px', borderRadius: 3,
      }}>
        {Math.round(camera.zoom * 100)}%
      </div>
    </div>
  );
}
