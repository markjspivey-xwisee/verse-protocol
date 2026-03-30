import { createElement } from 'react';

/**
 * Shared markdown-to-JSX renderer for verse content.
 */
export function renderMarkdown(text) {
  return text.split('\n').map((line, i) => {
    if (line.startsWith('# ')) return null;
    if (line.startsWith('## '))
      return createElement('div', { key: i, style: { fontSize: 12, fontWeight: 700, color: '#c8b6ff', marginTop: 16, marginBottom: 6 } }, line.replace('## ', ''));
    if (line.startsWith('### '))
      return createElement('div', { key: i, style: { fontSize: 11, fontWeight: 700, color: '#a098b4', marginTop: 12, marginBottom: 4 } }, line.replace('### ', ''));
    if (line.startsWith('- **'))
      return createElement('div', { key: i, style: { fontSize: 11, color: '#8a829e', lineHeight: 1.6, paddingLeft: 12 }, dangerouslySetInnerHTML: { __html: line.replace(/\*\*(.+?)\*\*/g, '<strong style="color:#e8e4f0">$1</strong>').replace(/\*(.+?)\*/g, '<em>$1</em>').replace(/^- /, '\u2022 ') } });
    if (line.startsWith('- '))
      return createElement('div', { key: i, style: { fontSize: 11, color: '#8a829e', lineHeight: 1.6, paddingLeft: 12 } }, '\u2022 ' + line.slice(2));
    if (line.startsWith('|') && line.includes('---|')) return null;
    if (line.startsWith('|'))
      return createElement('div', { key: i, style: { fontSize: 10, color: '#665f7a', lineHeight: 1.8, fontFamily: 'monospace' } }, line);
    if (line.startsWith('---')) return null;
    if (line.startsWith('**') && line.endsWith('**'))
      return createElement('div', { key: i, style: { fontSize: 11, color: '#a098b4', lineHeight: 1.6, marginTop: 4 } }, createElement('strong', null, line.replace(/\*\*/g, '')));
    if (line.trim() === '')
      return createElement('div', { key: i, style: { height: 8 } });
    return createElement('div', { key: i, style: { fontSize: 11, color: '#8a829e', lineHeight: 1.7 }, dangerouslySetInnerHTML: { __html: line.replace(/\*\*(.+?)\*\*/g, '<strong style="color:#e8e4f0">$1</strong>').replace(/\*(.+?)\*/g, '<em>$1</em>') } });
  });
}
