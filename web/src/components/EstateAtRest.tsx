/** The estate before the agent runs - the hero's one visual object.
 *
 *  Every name and every edge below is read from graph.json: LGPOLICY is copied by
 *  exactly these eleven programs, which reach exactly these DB2 tables and these
 *  two batch jobs, which the scheduler triggers. Nothing here is arranged for
 *  looks; it is the closure the page spends the next twelve sections proving.
 *
 *  Drawn as one SVG with a viewBox, so it scales instead of clipping - the
 *  previous version placed absolute divs at fixed pixels, which meant it clustered
 *  on a wide screen and fell off the edge on a narrow one.
 *
 *  At rest, deliberately: the reasoning trace further down is what lights up, and
 *  if the fold were already animating the two would say the same thing.
 */

/* Framed on the drawing itself: the content runs from the hub's left edge to
   the scheduler's right one, so no dead margin gets scaled into view. Anchored
   left, so a narrow screen keeps the hub and its fan rather than a slice of
   the middle with both ends cut off. */
const VIEW = "120 0 1490 356";   // 4.19:1, matched to the band so `slice` crops margin, not nodes

/** Rings, outward from the copybook every change starts at. */
const HUB = { id: "LGPOLICY", kind: "cpy", x: 300, y: 180 };

/** The eleven programs that COPY LGPOLICY, fanned across the middle band. */
const PROGRAMS = [
  "LGBATCH", "LGACDB01", "LGACDB02", "LGACUS01", "LGAPDB01", "LGICDB01",
  "LGICUS01", "LGIPDB01", "LGIPOL01", "LGUCDB01", "LGUPDB01",
];

/** What those programs touch, and where the batch chain ends. */
const OUTER = [
  { id: "CUSTOMER", kind: "db2", x: 1010, y: 44 },
  { id: "MOTOR", kind: "db2", x: 1180, y: 104 },
  { id: "ENDOWMENT", kind: "db2", x: 1006, y: 164 },
  { id: "HOUSE", kind: "db2", x: 1188, y: 224 },
  { id: "DAILYPOL", kind: "job", x: 1000, y: 286 },
  { id: "POLRPT", kind: "job", x: 1196, y: 330 },
  { id: "SDAILYPOL", kind: "sch", x: 1420, y: 286 },
];

const KIND_COLOR: Record<string, string> = {
  cpy: "#be95ff", pgm: "#33b1ff", db2: "#08bdba", job: "#ff832b", sch: "#ffb3b8",
};

/** Plex Mono advances at .6em, so a box is its label plus its padding. */
const boxWidth = (label: string) => Math.round(label.length * 7.2) + 26;
const BOX_H = 26;

/** The eleven sit on an arc to the right of the hub: an even fan reads as a
 *  fan-in, which is precisely the fact the section headline states. */
const ring = PROGRAMS.map((id, i) => {
  const t = PROGRAMS.length === 1 ? 0.5 : i / (PROGRAMS.length - 1);
  const angle = (-64 + t * 128) * (Math.PI / 180);
  return { id, kind: "pgm", x: HUB.x + Math.cos(angle) * 330, y: HUB.y + Math.sin(angle) * 172 };
});

const ALL = [HUB, ...ring, ...OUTER];
const at = (id: string) => ALL.find((n) => n.id === id)!;

/** Edges are drawn centre to centre; the boxes are painted over them afterwards,
 *  so every line ends exactly at the border it should. */
const EDGES: Array<[string, string, number]> = [
  ...PROGRAMS.map((p) => [p, "LGPOLICY", 0.5] as [string, string, number]),
  ["LGACDB01", "CUSTOMER", 0.3], ["LGACDB02", "CUSTOMER", 0.3],
  ["LGAPDB01", "MOTOR", 0.3], ["LGIPDB01", "ENDOWMENT", 0.3],
  ["LGUPDB01", "HOUSE", 0.3], ["LGICDB01", "ENDOWMENT", 0.3],
  ["LGBATCH", "DAILYPOL", 0.34], ["LGIPDB01", "POLRPT", 0.34],
  ["DAILYPOL", "SDAILYPOL", 0.34],
];

function Node({ n }: { n: { id: string; kind: string; x: number; y: number } }) {
  const w = boxWidth(n.id);
  const x = n.x - w / 2;
  const y = n.y - BOX_H / 2;
  const hub = n.kind === "cpy";
  return (
    <g>
      <rect x={x} y={y} width={w} height={BOX_H} fill="#1b1b1b" stroke={hub ? "#4a4a4a" : "#333"} strokeWidth="1" />
      {/* Carbon marks a kind with a rule, not a pill. */}
      <rect x={x} y={y} width="3" height={BOX_H} fill={KIND_COLOR[n.kind]} opacity={hub ? 0.9 : 0.55} />
      <text x={x + 13} y={n.y + 4} fill={hub ? "#b4b4b4" : "#7d7d7d"}
            fontFamily='"IBM Plex Mono", monospace' fontSize="12.5" letterSpacing="0.2">
        {n.id}
      </text>
    </g>
  );
}

export default function EstateAtRest() {
  return (
    <div className="ce-estate" aria-hidden="true">
      <svg viewBox={VIEW} preserveAspectRatio="xMinYMid slice" role="presentation">
        <g>
          {EDGES.map(([a, b, o], i) => {
            const s = at(a), d = at(b);
            return <line key={i} x1={s.x} y1={s.y} x2={d.x} y2={d.y} stroke="#454545" strokeWidth="1" opacity={o} />;
          })}
        </g>
        {ALL.map((n) => <Node key={n.id} n={n} />)}
      </svg>
    </div>
  );
}
