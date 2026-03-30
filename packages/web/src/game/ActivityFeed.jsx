import { useState, useEffect, useRef } from 'react';

const REPO = 'markjspivey-xwisee/verse-protocol';
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export default function ActivityFeed() {
  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const cacheRef = useRef({ data: null, timestamp: 0 });

  useEffect(() => {
    const now = Date.now();
    if (cacheRef.current.data && now - cacheRef.current.timestamp < CACHE_TTL) {
      setIssues(cacheRef.current.data);
      setLoading(false);
      return;
    }

    fetch(`https://api.github.com/repos/${REPO}/issues?labels=verse-proposal&state=all&per_page=8&sort=created&direction=desc`)
      .then(r => {
        if (!r.ok) throw new Error(`GitHub API: ${r.status}`);
        return r.json();
      })
      .then(data => {
        cacheRef.current = { data, timestamp: Date.now() };
        setIssues(data);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  if (loading) return (
    <div style={{ fontSize: 10, color: '#3a3550', padding: '8px 0' }}>
      Loading activity...
    </div>
  );

  if (error) return (
    <div style={{ fontSize: 10, color: '#3a3550', padding: '8px 0' }}>
      Activity unavailable
    </div>
  );

  if (issues.length === 0) return (
    <div style={{ fontSize: 10, color: '#3a3550', padding: '8px 0' }}>
      No recent proposals
    </div>
  );

  return (
    <div>
      {issues.map(issue => {
        const isOpen = issue.state === 'open';
        const ago = timeSince(new Date(issue.created_at));
        return (
          <a key={issue.id}
            href={issue.html_url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'block', padding: '6px 10px', marginBottom: 4,
              background: 'rgba(255,255,255,0.02)', borderRadius: 3,
              fontSize: 10, color: '#8a829e', textDecoration: 'none',
              border: '1px solid rgba(255,255,255,0.04)',
              transition: 'background 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(200,182,255,0.06)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{
                width: 6, height: 6, borderRadius: '50%',
                background: isOpen ? '#f59e0b' : '#4ade80',
                flexShrink: 0,
              }} />
              <span style={{ color: '#a098b4', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {issue.title.replace(/^\[(Extend|Fork|Merge)\]\s*/, '')}
              </span>
            </div>
            <div style={{ color: '#3a3550', marginTop: 2 }}>
              @{issue.user.login} · {ago} · {isOpen ? 'in progress' : 'built'}
            </div>
          </a>
        );
      })}
    </div>
  );
}

function timeSince(date) {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
