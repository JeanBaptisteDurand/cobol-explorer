import { Fragment, type ReactNode } from "react";

// A COBOL source citation like "lgipol01.cbl:55" or "LGPOLICY.cpy".
const CITE = /\b([\w-]+\.(?:cbl|cpy|jcl|bms|csd))(?::(\d+))?/gi;

function inline(text: string, onCite: ((f: string, l?: number) => void) | undefined, kb: string): ReactNode[] {
  const out: ReactNode[] = [];
  // Split on **bold** and `code` spans first, then scan plain runs for citations.
  text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).forEach((tok, ti) => {
    if (/^\*\*[^*]+\*\*$/.test(tok)) return out.push(<b key={`${kb}b${ti}`}>{tok.slice(2, -2)}</b>);
    if (/^`[^`]+`$/.test(tok)) return out.push(<code key={`${kb}c${ti}`} className="md-code">{tok.slice(1, -1)}</code>);
    let last = 0;
    let m: RegExpExecArray | null;
    CITE.lastIndex = 0;
    while ((m = CITE.exec(tok))) {
      if (m.index > last) out.push(tok.slice(last, m.index));
      const file = m[1];
      const line = m[2] ? parseInt(m[2], 10) : undefined;
      out.push(
        <a key={`${kb}cite${ti}-${m.index}`} className="md-cite" title="Open the source" onClick={() => onCite?.(file, line)}>
          {m[0]}
        </a>
      );
      last = m.index + m[0].length;
    }
    if (last < tok.length) out.push(<Fragment key={`${kb}t${ti}`}>{tok.slice(last)}</Fragment>);
  });
  return out;
}

export default function Markdown({ text, onCite }: { text: string; onCite?: (f: string, l?: number) => void }) {
  const lines = text.split("\n");
  const blocks: ReactNode[] = [];
  let list: ReactNode[] | null = null;
  let key = 0;
  const flush = () => { if (list) { blocks.push(<ul key={key++} className="md-ul">{list}</ul>); list = null; } };

  for (let i = 0; i < lines.length; i++) {
    const ln = lines[i];
    if (ln.startsWith("```")) {
      flush();
      const buf: string[] = [];
      for (i++; i < lines.length && !lines[i].startsWith("```"); i++) buf.push(lines[i]);
      blocks.push(<pre key={key++} className="md-pre">{buf.join("\n")}</pre>);
      continue;
    }
    const h = ln.match(/^(#{1,3})\s+(.*)$/);
    if (h) { flush(); blocks.push(<div key={key++} className="md-h">{inline(h[2], onCite, `h${i}`)}</div>); continue; }
    const li = ln.match(/^\s*[-*]\s+(.*)$/);
    if (li) { (list ??= []).push(<li key={key++}>{inline(li[1], onCite, `li${i}`)}</li>); continue; }
    if (ln.trim() === "") { flush(); continue; }
    flush();
    blocks.push(<div key={key++} className="md-p">{inline(ln, onCite, `p${i}`)}</div>);
  }
  flush();
  return <div className="md">{blocks}</div>;
}
