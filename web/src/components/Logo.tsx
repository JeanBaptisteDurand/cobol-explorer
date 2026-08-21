/** The mark: one node, and everything it takes down with it.
 *
 *  Not an abstract glyph — it is the product's single claim drawn literally. The solid
 *  blue square is the entity you are about to change; the three outlined squares are
 *  what depends on it; the hairlines are the edges the graph traverses to find them.
 *  A reader who has seen the impact view recognises it immediately, and a reader who
 *  has not still reads "one thing connected to others".
 *
 *  Built to survive 16px: three edges, no curves, 1.5px strokes, nothing that turns to
 *  mush when the browser rounds it down.
 */
export default function Logo({ size = 22, title }: { size?: number; title?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none"
      role={title ? "img" : undefined} aria-hidden={title ? undefined : true} aria-label={title}>
      {title && <title>{title}</title>}
      {/* edges — drawn first so the nodes sit on top of them */}
      <g stroke="var(--interactive)" strokeWidth="1.5" strokeLinecap="round">
        <path d="M11 16 H21" />
        <path d="M12.5 12 L20 7.5" />
        <path d="M12.5 20 L20 24.5" />
      </g>
      {/* the impacted set */}
      <g stroke="var(--text-secondary)" strokeWidth="1.6" fill="none">
        <rect x="21" y="3.6" width="7.8" height="7.8" rx="1.6" />
        <rect x="21" y="12.1" width="7.8" height="7.8" rx="1.6" />
        <rect x="21" y="20.6" width="7.8" height="7.8" rx="1.6" />
      </g>
      {/* the entity being changed */}
      <rect x="2.6" y="11.4" width="9.2" height="9.2" rx="2.2" fill="var(--interactive)" />
    </svg>
  );
}
