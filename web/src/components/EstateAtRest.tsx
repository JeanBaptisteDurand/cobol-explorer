/** The estate before the agent runs.
 *
 *  Resend puts one large, almost invisible object under its headline. Ours is not
 *  an object: it is the product in its resting state — real GenApp entities, dim,
 *  wide, bleeding off the right edge so the field reads as bigger than the screen.
 *
 *  It is deliberately readable rather than greyed out. The reasoning trace further
 *  down is what greys and lights up; if the fold were already dimmed, the two
 *  states would say the same thing and neither would land.
 *
 *  Coordinates are authored against a 1100x250 box and clipped, so the layout is
 *  identical on every render and costs nothing to compute.
 */
const NODES = [
  { kind: "PGM", id: "LGACUS01", x: 60, y: 82, dim: 2 },
  { kind: "CPY", id: "LGPOLICY", x: 296, y: 82, dim: 1 },
  { kind: "PGM", id: "LGACDB01", x: 452, y: 44, dim: 2 },
  { kind: "JOB", id: "DAILYPOL", x: 436, y: 150, dim: 2 },
  { kind: "TBL", id: "POLICY", x: 626, y: 32, dim: 3 },
  { kind: "PGM", id: "LGIPOL01", x: 640, y: 172, dim: 3 },
  { kind: "MAP", id: "SSMAP", x: 800, y: 104, dim: 3 },
  { kind: "PGM", id: "LGUPDB01", x: 940, y: 60, dim: 4 },
  { kind: "TXN", id: "SSC1", x: 120, y: 186, dim: 4 },
  { kind: "PGM", id: "LGTESTC1", x: 1060, y: 140, dim: 4 },
];

/** Only the edges between nodes that are both on screen at 1440. */
const EDGES = [
  { x: 150, y: 96, w: 150, r: 0 },
  { x: 300, y: 96, w: 150, r: -15 },
  { x: 300, y: 96, w: 140, r: 14 },
  { x: 452, y: 57, w: 170, r: 0 },
  { x: 436, y: 130, w: 190, r: 9 },
  { x: 640, y: 57, w: 160, r: -11 },
  { x: 790, y: 120, w: 150, r: 0 },
];

export default function EstateAtRest() {
  return (
    <div className="ce-estate" aria-hidden="true">
      {EDGES.map((e, i) => (
        <span key={i} className="ce-estate-edge"
              style={{ left: e.x, top: e.y, width: e.w, transform: `rotate(${e.r}deg)` }} />
      ))}
      {NODES.map((n) => (
        <span key={n.id} className={`ce-estate-node is-dim-${n.dim}`} style={{ left: n.x, top: n.y }}>
          <i>{n.kind}</i>{n.id}
        </span>
      ))}
    </div>
  );
}
