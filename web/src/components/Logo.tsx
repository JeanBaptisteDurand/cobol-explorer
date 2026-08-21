/** The mark: an aperture. The C opens, and the light gets out.
 *
 *  It is the product's claim in one shape — a closed system that has been opened,
 *  with something legible coming out of it. The C is the estate; the point at the
 *  centre is the entity you asked about; the beam is the answer leaving through
 *  the opening.
 *
 *  Geometry, so it can be rebuilt at any size without redrawing by eye:
 *    · arc of 278°, opening centred on the +x axis, half-gap 41°
 *    · mid-radius 8.4 and stroke 5.2 on a 32 grid — outer radius exactly 11
 *    · the beam's apex is the centre point, its tip reaches just past the outer
 *      radius, half-height 0.42 of that radius
 *    · nothing is rounded: the terminals are butt-cut, like everything else here
 *
 *  Built to survive 16px: one arc, one triangle, one dot, no detail that turns to
 *  mush when the browser rounds it down.
 */
const R_MID = 8.4;
const STROKE = 5.2;
const CX = 14.5;
const CY = 16;

/** Terminal of the arc at ±41°, where the C stops and the opening begins. */
const GAP = (41 * Math.PI) / 180;
const TX = +(CX + R_MID * Math.cos(GAP)).toFixed(2);
const TY_LOW = +(CY + R_MID * Math.sin(GAP)).toFixed(2);
const TY_HIGH = +(CY - R_MID * Math.sin(GAP)).toFixed(2);

const ARC = `M ${TX} ${TY_LOW} A ${R_MID} ${R_MID} 0 1 1 ${TX} ${TY_HIGH}`;
const BEAM = `M ${CX} ${CY} L 27.6 11.4 L 27.6 20.6 Z`;

export default function Logo({
  size = 22,
  title,
  ring = "#e8e6e1",
  accent = "#ffb020",
}: {
  size?: number;
  title?: string;
  /** The C. Off-white by default; pass a token to make it follow the theme. */
  ring?: string;
  /** The point and the beam — they are always the same colour, because they are
   *  the same idea: the thing you asked about, and its answer. */
  accent?: string;
}) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none"
      role={title ? "img" : undefined} aria-hidden={title ? undefined : true} aria-label={title}>
      {title && <title>{title}</title>}
      <path d={ARC} stroke={ring} strokeWidth={STROKE} fill="none" />
      <path d={BEAM} fill={accent} />
      <circle cx={CX} cy={CY} r="1.95" fill={accent} />
    </svg>
  );
}
