import { useState, useEffect, useRef } from 'react';

const CHANNEL_NAME = 'verse-world-presence';
const HEARTBEAT_MS = 3000;
const STALE_MS = 10000;

/**
 * BroadcastChannel hook for same-browser tab awareness.
 * Shows how many other tabs are exploring and where they are.
 */
export function usePresence(currentNodeId) {
  const [peers, setPeers] = useState({});
  const tabId = useRef(Math.random().toString(36).slice(2, 8));
  const channelRef = useRef(null);

  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return;

    try {
      const channel = new BroadcastChannel(CHANNEL_NAME);
      channelRef.current = channel;

      channel.onmessage = (e) => {
        const { type, nodeId, id, timestamp } = e.data;
        if (type === 'location' && id !== tabId.current) {
          setPeers(prev => ({
            ...prev,
            [id]: { nodeId, timestamp },
          }));
        }
      };

      // Broadcast own location
      const broadcast = () => {
        channel.postMessage({
          type: 'location',
          nodeId: currentNodeId,
          id: tabId.current,
          timestamp: Date.now(),
        });
      };

      broadcast();
      const interval = setInterval(broadcast, HEARTBEAT_MS);

      // Clean up stale peers
      const cleanup = setInterval(() => {
        const now = Date.now();
        setPeers(prev => {
          const next = {};
          for (const [id, p] of Object.entries(prev)) {
            if (now - p.timestamp < STALE_MS) next[id] = p;
          }
          return next;
        });
      }, STALE_MS);

      return () => {
        clearInterval(interval);
        clearInterval(cleanup);
        channel.close();
      };
    } catch {
      // BroadcastChannel not supported
    }
  }, [currentNodeId]);

  const peerList = Object.entries(peers).map(([id, p]) => ({
    id,
    nodeId: p.nodeId,
  }));

  return { peers: peerList, tabId: tabId.current };
}
