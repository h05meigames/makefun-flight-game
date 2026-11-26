// The flight model: one fixed step of the Skylark's flight. Throttle sets a
// target speed, banking turns the plane (turn rate grows with bank and falls
// with speed, as a real coordinated turn does), pitch sets the climb, and
// below stall speed the wings give up and the nose drops. Fuel burns with the
// throttle; the ground, the rings and the beacons are all checked here, so a
// landing and a crash read as two different outcomes, never the same one.

import { BEACON, COURSE_LENGTH, FUEL, PLANE, RING } from './config.js';

const GRAVITY = 9.81;
const DEG = Math.PI / 180;

export function createPlane() {
  return {
    x: 0, y: 2, z: 100,
    heading: 0, speed: 0, bank: 0, pitch: 0,
    throttle: 0, verticalSpeed: 0,
    fuel: FUEL.start, damage: 0,
    gearDown: true, airborne: false, landed: false,
  };
}

/**
 * Advance the plane one step. `steer` is {bank, pitch} in [-1, 1] from the
 * stick (keys or mouse); `throttleDelta` is -1, 0 or 1 from the throttle keys.
 * Returns a list of event names that happened on this step.
 */
export function stepFlight(plane, world, mission, steer, throttleDelta, dt) {
  const events = [];

  plane.throttle = Math.max(0, Math.min(1, plane.throttle + throttleDelta * dt * 0.9));

  // Speed chases the throttle: full throttle is fast, idle is a slow glide.
  // On the ground the plane only rolls with throttle — at idle it stands
  // still, so a landing ends in a stop instead of a runaway roll.
  const targetSpeed = plane.airborne
    ? PLANE.idleSpeed + plane.throttle * (PLANE.maxSpeed - PLANE.idleSpeed)
    : plane.throttle * PLANE.maxSpeed;
  plane.speed += (targetSpeed - plane.speed) * (1 - Math.exp(-dt * 0.45));

  // Bank eases toward the stick, then a coordinated turn follows from it.
  const targetBank = steer.bank * PLANE.maxBankDeg * DEG;
  plane.bank += (targetBank - plane.bank) * (1 - Math.exp(-dt * 2.2));
  if (plane.airborne && plane.speed > 5) {
    // A coordinated turn: banking right (positive bank) turns the nose
    // right, toward increasing heading, at g*tan(bank)/speed.
    const turnRate = (GRAVITY * Math.tan(plane.bank)) / Math.max(plane.speed, 12);
    plane.heading += turnRate * dt;
  }

  // Pitch eases toward the stick; a stalled wing cannot hold altitude.
  const targetPitch = steer.pitch * PLANE.maxPitchDeg * DEG;
  plane.pitch += (targetPitch - plane.pitch) * (1 - Math.exp(-dt * 2.0));
  let verticalSpeed = Math.sin(plane.pitch) * plane.speed;
  if (plane.airborne && plane.speed < PLANE.stallSpeed) {
    verticalSpeed -= (PLANE.stallSpeed - plane.speed) * 1.4;
    if (plane.speed < PLANE.stallSpeed - 6 && !plane._stallWarned) {
      plane._stallWarned = true;
      events.push('stall');
    }
  } else if (plane.speed > PLANE.stallSpeed + 4) {
    plane._stallWarned = false;
  }
  plane.verticalSpeed = verticalSpeed;

  // Move along the heading, then climb or sink.
  plane.x += Math.sin(plane.heading) * plane.speed * dt;
  plane.z += Math.cos(plane.heading) * plane.speed * dt;
  if (plane.airborne) plane.y += verticalSpeed * dt;

  // Flying off the chart turns the plane gently back toward the course.
  if (Math.abs(plane.x) > 700 || plane.z < -400 || plane.z > COURSE_LENGTH + 600) {
    plane.heading += (0 - plane.heading) * dt * 0.15;
  }

  // Fuel burns with the throttle; empty tanks mean a dead-stick glide.
  plane.fuel = Math.max(0, plane.fuel - dt * (FUEL.idleBurn + plane.throttle * FUEL.throttleBurn));
  if (plane.fuel <= 0 && plane.throttle > 0) {
    plane.throttle = 0;
    events.push('fuel-out');
  }
  if (plane.fuel <= FUEL.lowWarning && !plane._fuelWarned) {
    plane._fuelWarned = true;
    events.push('fuel-low');
  } else if (plane.fuel > FUEL.lowWarning + 5) {
    plane._fuelWarned = false;
  }

  // Takeoff: fast enough on the runway and the stick back, and she flies.
  const ground = world.groundHeightAt(plane.x, plane.z);
  if (!plane.airborne) {
    plane.y = ground;
    if (plane.speed >= PLANE.rotateSpeed && steer.pitch > 0.15) {
      plane.airborne = true;
      plane.y = ground + 0.5;
      events.push('takeoff');
    }
  }

  if (plane.airborne) {
    // Rings: fly through the hoop and it counts.
    for (const ring of world.rings) {
      if (ring.passed) continue;
      const dz = plane.z - ring.z;
      if (Math.abs(dz) > 26) continue;
      const dx = plane.x - ring.x;
      const dy = plane.y - ring.y;
      if (Math.hypot(dx, dy) < RING.radius) {
        ring.passed = true;
        events.push(`ring:${ring.id}`);
      }
    }
    // Beacons: fly close enough and the delivery is logged.
    for (const beacon of world.beacons) {
      if (beacon.visited) continue;
      const d = Math.hypot(plane.x - beacon.x, plane.y - beacon.y, plane.z - beacon.z);
      if (d < BEACON.radius) {
        beacon.visited = true;
        events.push(`beacon:${beacon.id}`);
      }
    }

    // The ground arrives: a runway touchdown is a landing, anything else
    // at flying speed is a crash, and a gentle brush costs damage.
    if (plane.y <= ground) {
      const runway = world.terrainAt(plane.x, plane.z) === 'runway';
      const sink = -verticalSpeed;
      const aligned = Math.abs(plane.heading) < 0.35 && Math.abs(plane.x) <= 16;
      const gentle = sink <= PLANE.safeSink && plane.speed <= PLANE.safeTouchSpeed;
      if (runway && gentle && aligned && plane.gearDown) {
        plane.y = ground;
        plane.airborne = false;
        plane.landed = true;
        events.push('landed');
      } else if (runway && sink <= PLANE.safeSink + 1.5 && plane.speed <= PLANE.safeTouchSpeed + 15) {
        // A hard runway touchdown: the gear holds, the airframe does not.
        plane.damage = Math.min(100, plane.damage + 30 + sink * 6);
        plane.y = ground;
        plane.airborne = false;
        plane.landed = true;
        events.push('hard-landing');
        if (plane.damage >= 100) events.push('crashed');
      } else {
        plane.y = ground;
        events.push('crashed');
      }
    }
  }

  if (mission) mission.noteEvents(events, plane);
  return events;
}

/** Heading in degrees, 0-360, for the compass. */
export function headingDegrees(plane) {
  return ((plane.heading / DEG) % 360 + 360) % 360;
}

/** Speed in knots, for the HUD. */
export function knots(plane) {
  return plane.speed * 1.944;
}

/** Altitude in feet, for the HUD. */
export function feet(plane) {
  return plane.y * 3.281;
}
