// Skylark Isles — every tuning number and colour in one place.
// The playfield is a fixed 1280x720 logical area; the renderer scales it to
// the window, so no rule below depends on the screen size.

export const FIELD = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second. */
export const STEP = 1 / 60;

/** Perspective focal length, in logical pixels, for the chase camera. */
export const FOCAL = 620;

/** How far ahead the terrain is drawn, in metres. */
export const VIEW_DISTANCE = 2600;

/** Ground is drawn in strips of this length, in metres. */
export const STRIP = 100;

/** The whole course runs from the home runway to the far runway, in metres. */
export const COURSE_LENGTH = 10200;

export const PLANE = {
  /** Top speed at full throttle, m/s (about 235 kt). */
  maxSpeed: 122,
  /** Speed the engine idles toward with the throttle closed, m/s. */
  idleSpeed: 26,
  /** Stall speed: below this the wings stop flying and the nose drops. */
  stallSpeed: 28,
  /** Max bank angle, degrees. */
  maxBankDeg: 48,
  /** Max pitch angle the stick can command, degrees. */
  maxPitchDeg: 14,
  /** Takeoff rotation speed, m/s. */
  rotateSpeed: 30,
  /** Landing is safe below this ground speed, m/s. */
  safeTouchSpeed: 55,
  /** Landing is safe below this sink rate, m/s. */
  safeSink: 3.2,
};

export const FUEL = {
  start: 100,
  /** %/s burned at idle. */
  idleBurn: 0.15,
  /** Extra %/s burned at full throttle. */
  throttleBurn: 0.35,
  lowWarning: 25,
};

export const RING = { radius: 20, score: 250 };
export const BEACON = { radius: 42, score: 400 };
export const LANDING_SCORE = 1000;

export const PALETTE = {
  skyTop: '#2f6fb2',
  skyMid: '#7db4dd',
  skyHorizon: '#cfe8f2',
  sun: '#fff3c4',
  seaDeep: '#14557f',
  seaShallow: '#2f8fb5',
  sand: '#e8d39a',
  grassA: '#5da24a',
  grassB: '#4c8f3e',
  fieldA: '#8fae4e',
  fieldB: '#c2a44e',
  forest: '#2f6b2e',
  rock: '#8a7f72',
  runway: '#3a3f46',
  runwayMark: '#f4f6f8',
  ring: '#ffc93c',
  ringPassed: '#7ee081',
  panel: '#10151d',
  panelEdge: '#2c3644',
  text: '#eef3f7',
  muted: '#9fb0bf',
  warn: '#ff9a3c',
  danger: '#ff5a4e',
  good: '#7ee081',
  accent: '#ffc93c',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'skylark-isles.best';

/** Fixed world seed: the same seed gives the same islands, every visit. */
export const WORLD_SEED = 20261126;
