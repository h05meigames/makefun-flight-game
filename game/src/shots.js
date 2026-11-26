// Screenshot staging: `?shot=start|play|landing|end&seed=1` puts the game in
// a fixed, repeatable scene and renders it once, so a screenshot is a real
// render of the game's own code in a browser. The play and landing scenes
// are flown there by a simple autopilot that steers toward the next ring or
// the far runway, the same way a player would.

import { STEP } from './config.js';
import { createMission, MISSIONS } from './missions.js';
import { createPlane, stepFlight } from './physics.js';

const START_SECONDS = 6;
const PLAY_SECONDS = 24;
const LANDING_SECONDS = 100;

/** Steer toward a world point, gently, the way a careful pilot would. */
function steerToward(plane, target) {
  const dx = target.x - plane.x;
  const dz = target.z - plane.z;
  const wantHeading = Math.atan2(dx, dz);
  let diff = wantHeading - plane.heading;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  // A proportional controller on heading alone snakes: the bank lags the
  // stick, so the heading overshoots and the plane weaves. Damp it with the
  // bank already held, and add a small direct pull toward the lateral offset
  // so the plane joins the line early instead of chasing it.
  const maxBank = (48 * Math.PI) / 180;
  const bank = Math.max(
    -1,
    Math.min(1, diff * 2.2 - 0.9 * (plane.bank / maxBank) + Math.max(-0.25, Math.min(0.25, dx * 0.002))),
  );
  const dy = target.y - plane.y;
  const pitch = Math.max(-1, Math.min(1, dy * 0.02));
  return { bank, pitch };
}

function autopilotStep(plane, world, mission, mode) {
  let target;
  if (mode === 'landing') {
    // Stay high over the mountain isle, then a gentle descent onto the strip.
    const cruise = Math.max(60, 300 - Math.max(0, plane.z - 6000) * 0.09);
    target = { x: 0, y: cruise, z: world.farRunway.z0 + 260 };
    if (plane.z > world.farRunway.z0 - 900) target = { x: 0, y: 55, z: world.farRunway.z0 + 260 };
  } else {
    const ring = world.rings.find((r) => !r.passed);
    target = ring ?? { x: 0, y: 160, z: world.farRunway.z0 + 260 };
  }
  const steer = steerToward(plane, target);
  // Throttle discipline: cruise at 70%, ease off near a ring so the turn
  // tightens and the hoop is met, not overshot.
  const dist = Math.hypot(target.x - plane.x, target.y - plane.y, target.z - plane.z);
  const wantThrottle = mode === 'landing' ? 0.7 : (dist < 600 ? 0.45 : 0.7);
  const throttleDelta = plane.throttle < wantThrottle - 0.02 ? 1 : (plane.throttle > wantThrottle + 0.02 ? -1 : 0);
  return stepFlight(plane, world, mission, steer, throttleDelta, STEP);
}

/**
 * Set `game` to the named scene (start, play, landing or end) and return the
 * screen to draw over it and the best score to show.
 */
export function stageShot(name, game) {
  const { world } = game;
  world.reset();
  const mission = createMission(MISSIONS[0]);
  game.mission = mission;
  const plane = createPlane();
  game.plane = plane;
  game.elapsed = 0;

  if (name !== 'play' && name !== 'landing' && name !== 'end') {
    // Title: the Skylark sits on the home runway at dawn light, ready to go.
    plane.throttle = 0.25;
    for (let i = 0; i < START_SECONDS / STEP; i += 1) {
      stepFlight(plane, world, mission, { bank: 0, pitch: 0 }, 0, STEP);
    }
    return { screen: 'title', best: 1250 };
  }

  // Fly out under autopilot: takeoff, then toward the rings.
  plane.throttle = 0.6;
  const mode = name === 'landing' ? 'landing' : 'play';
  if (name === 'end') {
    // The finale: rings 1-11 already flown, the Skylark lined up on the last
    // ring — fly it, and the mission completes for real.
    for (const ring of world.rings) if (ring.id < 12) ring.passed = true;
    mission.ringsFlown = 11;
    plane.z = 8700;
    plane.y = 170;
    plane.speed = 78;
    plane.airborne = true;
    plane.throttle = 0.6;
    for (let i = 0; i < 30 / STEP; i += 1) {
      game.elapsed += STEP;
      autopilotStep(plane, world, mission, 'play');
      if (mission.done || mission.failed) break;
    }
    return { screen: mission.done || mission.failed ? 'end' : 'flying', best: Math.max(1250, mission.score) };
  }
  const limit = name === 'landing' ? LANDING_SECONDS : PLAY_SECONDS;
  for (let i = 0; i < limit / STEP; i += 1) {
    game.elapsed += STEP;
    const events = autopilotStep(plane, world, mission, mode);
    if (events.includes('landed') || events.includes('crashed')) break;
    if (mission.done || mission.failed) break;
  }
  if (name === 'landing') {
    // Frame the final approach: gear down, lined up on the far strip.
    plane.gearDown = true;
    return { screen: 'flying', best: 1250 };
  }
  return { screen: 'flying', best: 1250 };
}
