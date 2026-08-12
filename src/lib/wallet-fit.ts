// ── Text that cannot overflow the Wallet strip ──────────────────────────────
//
// The band is 375×123pt and every line in it is SINGLE LINE by construction:
// there is no room for a second, and a wrapped line in a fixed-height box is
// how you get a name with its descenders sliced off. So every string is put
// through fitLine(), which returns a size — and, past the readable floor, a
// shortened string — that is guaranteed to fit the width it was given.
//
// Guaranteed, not estimated. The card templates' fitting (card-templates/
// shared.tsx) shrinks toward a floor and accepts a break past it, which is the
// right call on a card that can wrap. Here a break has nowhere to go, so the
// contract is different: fitLine never returns something wider than its box.
//
// Its own advance table rather than an import from shared.tsx, deliberately.
// That table is measured from Helvetica/Arial because that is what cards are
// pinned to render in; the strip is drawn by next/og with the renderer's own
// bundled face. Two renderers, two typefaces, two calibrations — sharing one
// table would make both wrong in opposite directions. The numbers below start
// from the same Helvetica advances and are then carried by a wider safety
// factor, because under-measuring here clips a name and over-measuring only
// costs a fraction of a point of size.

const W_UPPER: Record<string, number> = {
  I: 0.278, "'": 0.238, "-": 0.333, ".": 0.278, ",": 0.278, "1": 0.506, " ": 0.278,
  F: 0.611, L: 0.611, T: 0.611, Z: 0.611, J: 0.556,
  E: 0.667, P: 0.667, S: 0.667, V: 0.667, X: 0.667, Y: 0.667,
  A: 0.722, B: 0.722, C: 0.722, D: 0.722, H: 0.722, K: 0.722, N: 0.722, R: 0.722, U: 0.722, "&": 0.722,
  G: 0.778, O: 0.778, Q: 0.778, M: 0.833, W: 0.944,
};

const W_MIXED: Record<string, number> = {
  i: 0.333, j: 0.333, l: 0.333, I: 0.389, f: 0.412, t: 0.444, r: 0.482, " ": 0.278,
  s: 0.611, v: 0.611, y: 0.611, z: 0.556, "'": 0.278, "-": 0.333, ".": 0.333, ",": 0.333,
  a: 0.667, c: 0.667, e: 0.667, h: 0.667, k: 0.667, n: 0.667, o: 0.667, p: 0.667, q: 0.667, u: 0.667, x: 0.667,
  b: 0.676, d: 0.676, g: 0.676, w: 0.944, m: 1,
  F: 0.667, J: 0.667, L: 0.667, E: 0.722, S: 0.722, T: 0.722, Z: 0.722, P: 0.722,
  A: 0.778, B: 0.778, C: 0.778, D: 0.778, R: 0.778, V: 0.778, X: 0.778, Y: 0.778,
  G: 0.833, H: 0.833, K: 0.833, N: 0.833, O: 0.833, Q: 0.833, U: 0.833,
  M: 0.944, W: 1, "&": 0.889,
};

const DEFAULT_UPPER = 0.722;
const DEFAULT_MIXED = 0.667;

/**
 * Anything outside Latin-1 is measured as a FULL em.
 *
 * A Latin fallback average (0.667) under-measures CJK, Hangul, and emoji by
 * about a third, so a Japanese company name or a name with an emoji in it
 * sized fine on paper and then ran straight off the band. Full-width is the
 * correct advance for those scripts and a harmless over-estimate for the rest.
 */
const WIDE = 1;
function isWide(ch: string): boolean {
  const c = ch.codePointAt(0) ?? 0;
  return c > 0x024f;
}

/** Width of a string in em, at tracking 0. */
export function textEm(text: string, uppercase: boolean): number {
  const table = uppercase ? W_UPPER : W_MIXED;
  const fallback = uppercase ? DEFAULT_UPPER : DEFAULT_MIXED;
  let sum = 0;
  for (const raw of text) {
    if (isWide(raw)) { sum += WIDE; continue; }
    sum += table[uppercase ? raw.toUpperCase() : raw] ?? fallback;
  }
  return sum;
}

/**
 * Slack over the measured width.
 *
 * Wider than the cards' 1.08 for two reasons: the rendering face is not the
 * measured one, and this band has no second line to fall back to. The cost is
 * a percent or two of type size on long strings; the alternative is a clipped
 * name on somebody's business card.
 */
const SAFETY = 1.12;

/** Count of code points, not UTF-16 units — so an emoji truncates as one. */
const chars = (s: string) => Array.from(s);

export type FittedLine = {
  /** Possibly shortened. Render THIS, never the original. */
  text: string;
  fontSize: number;
  letterSpacing: string;
  /** True when the string had to be cut — surfaced so tests can assert on it. */
  truncated: boolean;
};

export type FitOpts = {
  /** Available width in px. */
  box: number;
  /** Ideal size in px. */
  base: number;
  /** Never render smaller than this; past it the string is cut instead. */
  min: number;
  uppercase?: boolean;
  /** em. Tightened before the size is reduced — it is decoration first. */
  tracking?: number;
  /**
   * How many lines this string may occupy. 1 for labels; 2 for the NAME.
   *
   * A person's name is the one string on the band that must not be cut.
   * "Konstantinos Papadopoulos-Winterbottom" cannot fit one 375pt line at any
   * readable size, and shortening it to "Konstantinos Papadopoulos-Winte…" is
   * worse than the second line it comfortably has room for.
   */
  maxLines?: number;
  /**
   * Largest size this line may GROW to, when it fits on one line at more than
   * `base`. Only the name uses it.
   *
   * Without it the band under-fills: "Aaron Lavi" at the 80px base occupies
   * 520 of its 719px box and leaves a third of the band empty, which is the
   * complaint this whole design exists to answer. Growth is capped by the
   * ONE-line fit, so it can never introduce a wrap or an overflow.
   */
  grow?: number;
};

/**
 * Two lines never hold exactly twice one line's worth: the first breaks at a
 * word boundary and gives back whatever was left. Measured against the real
 * corpus, budgeting 90% of the nominal two-line width is what keeps a wrapped
 * name inside its box.
 */
const WRAP_EFFICIENCY = 0.9;

/** Longest whitespace-delimited run — the piece that must survive whole. */
function longestWord(text: string): string {
  return text.split(" ").reduce((a, b) => (chars(b).length > chars(a).length ? b : a), "");
}

/**
 * Size (and if necessary shorten) one line so it fits `box`.
 *
 * Order of concessions, cheapest first: tracking, then size down to `min`,
 * then characters. Text is only ever cut once the size has bottomed out, so a
 * long name shrinks gracefully and a pathological one ends in an ellipsis
 * rather than disappearing off the edge.
 */
export function fitLine(raw: string | null | undefined, opts: FitOpts): FittedLine {
  const { box, base, min, uppercase = false } = opts;
  const lines = Math.max(1, Math.floor(opts.maxLines ?? 1));
  const tracking0 = opts.tracking ?? 0;
  const text = (raw ?? "").trim().replace(/\s+/g, " ");
  const none: FittedLine = { text: "", fontSize: base, letterSpacing: `${tracking0}em`, truncated: false };
  if (!text || box <= 0) return none;

  /** Total width the string needs, laid end to end. */
  const runAt = (s: string, fs: number, tr: number) =>
    (textEm(s, uppercase) + chars(s).length * tr) * fs * SAFETY;

  const budget = lines > 1 ? box * lines * WRAP_EFFICIENCY : box;

  /**
   * Largest size that satisfies BOTH constraints:
   *   - the whole string fits the multi-line budget, and
   *   - the longest single word still fits one line.
   * The second is what stops a wrapped line from breaking mid-word, which
   * Satori will happily do and which reads as a rendering fault.
   */
  const sizeFor = (s: string, tr: number) => {
    const whole = budget / Math.max(1e-6, runAt(s, 1, tr));
    const word = box / Math.max(1e-6, runAt(longestWord(s), 1, tr));
    return Math.min(whole, word);
  };

  // 1. Fits outright — and may grow into space it would otherwise waste.
  if (sizeFor(text, tracking0) >= base) {
    const oneLine = box / Math.max(1e-6, runAt(text, 1, tracking0));
    const grown = opts.grow && opts.grow > base ? Math.min(opts.grow, oneLine) : base;
    return {
      text,
      fontSize: Math.max(base, grown),
      letterSpacing: `${tracking0}em`,
      truncated: false,
    };
  }

  // 2. Tighten tracking, down to 40% of the design value (never below zero —
  //    negative tracking on a small label reads as a rendering fault).
  let tracking = tracking0;
  if (tracking0 > 0) {
    const em = textEm(text, uppercase);
    const n = chars(text).length;
    const needed = (budget / (base * SAFETY) - em) / n;
    tracking = Math.max(tracking0 * 0.4, Math.min(tracking0, needed));
    if (sizeFor(text, tracking) >= base) {
      return { text, fontSize: base, letterSpacing: `${Number(tracking.toFixed(3))}em`, truncated: false };
    }
  }

  // 3. Shrink, but not past the legibility floor.
  const ideal = sizeFor(text, tracking);
  if (ideal >= min) {
    return { text, fontSize: ideal, letterSpacing: `${Number(tracking.toFixed(3))}em`, truncated: false };
  }

  // 4. At the floor and still too wide — cut. Longest prefix that fits with the
  //    ellipsis already accounted for, so the visible result is never wider
  //    than the space it has.
  const cp = chars(text);
  let keep = 0;
  for (let i = 1; i <= cp.length; i++) {
    if (sizeFor(`${cp.slice(0, i).join("")}…`, tracking) < min) break;
    keep = i;
  }
  const cut = keep > 0 ? `${cp.slice(0, keep).join("").trimEnd()}…` : "";
  return { text: cut, fontSize: min, letterSpacing: `${Number(tracking.toFixed(3))}em`, truncated: true };
}
