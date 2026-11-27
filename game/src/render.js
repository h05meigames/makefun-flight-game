// The chase-view renderer: one consistent flat-shaded style for sky, sea,
// islands, runway, rings and the Skylark herself. The world is drawn back to
// front in ground strips projected through a pinhole camera that sits just
// behind and above the plane, so the runway and the next ring always read
// ahead of the aircraft.

import { FIELD, FOCAL, PALETTE, STRIP, VIEW_DISTANCE } from './config.js';

const DEG = Math.PI / 180;

/** Project a world point into screen space. Returns null when behind us. */
function project(cam, wx, wy, wz, heading) {
  const dx = wx - cam.x;
  const dz = wz - cam.z;
  const forward = dx * Math.sin(heading) + dz * Math.cos(heading);
  if (forward < 6) return null;
  const lateral = dx * Math.cos(heading) - dz * Math.sin(heading);
  const scale = FOCAL / forward;
  return {
    x: FIELD.width / 2 + lateral * scale,
    y: cam.horizonY - (wy - cam.y) * scale,
    scale,
    forward,
  };
}

function skyGradient(ctx, horizonY) {
  const g = ctx.createLinearGradient(0, 0, 0, horizonY + 40);
  g.addColorStop(0, PALETTE.skyTop);
  g.addColorStop(0.55, PALETTE.skyMid);
  g.addColorStop(1, PALETTE.skyHorizon);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, FIELD.width, horizonY + 40);
}

function drawSun(ctx, heading, time) {
  // The sun sits at a fixed bearing, so it slides across the sky as we turn.
  const bearing = 0.9 - heading;
  const x = FIELD.width / 2 + Math.tan(bearing) * FOCAL * 0.55;
  const y = 92 + Math.sin(time * 0.05) * 4;
  if (x < -80 || x > FIELD.width + 80) return;
  ctx.save();
  ctx.globalAlpha = 0.9;
  ctx.fillStyle = PALETTE.sun;
  ctx.shadowColor = '#fff8d0';
  ctx.shadowBlur = 46;
  ctx.beginPath();
  ctx.arc(x, y, 34, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawRidge(ctx, world, heading, horizonY) {
  // A far mountain ridge on the horizon, placed by bearing so turning the
  // plane pans across it like a real horizon.
  ctx.fillStyle = '#5d7ea6';
  ctx.beginPath();
  ctx.moveTo(0, horizonY + 2);
  for (const peak of world.ridge) {
    const x = FIELD.width / 2 + Math.tan(peak.bearing - heading) * FOCAL * 0.9;
    const y = horizonY - peak.height * 0.55;
    ctx.lineTo(x, y);
  }
  ctx.lineTo(FIELD.width, horizonY + 2);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  for (const peak of world.ridge) {
    const x = FIELD.width / 2 + Math.tan(peak.bearing - heading) * FOCAL * 0.9;
    const y = horizonY - peak.height * 0.55;
    ctx.beginPath();
    ctx.moveTo(x - 16, y + 14);
    ctx.lineTo(x, y);
    ctx.lineTo(x + 16, y + 14);
    ctx.closePath();
    ctx.fill();
  }
}

function drawCloud(ctx, cam, cloud, heading) {
  const p = project(cam, cloud.x, cloud.y, cloud.z, heading);
  if (!p) return;
  const r = cloud.size * p.scale * 0.16;
  if (r < 2) return;
  ctx.save();
  ctx.globalAlpha = 0.85;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.ellipse(p.x, p.y, r, r * 0.42, 0, 0, Math.PI * 2);
  ctx.ellipse(p.x - r * 0.7, p.y + r * 0.1, r * 0.6, r * 0.3, 0, 0, Math.PI * 2);
  ctx.ellipse(p.x + r * 0.7, p.y + r * 0.08, r * 0.65, r * 0.32, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function groundColour(world, x, z, terrain) {
  if (terrain === 'runway') return PALETTE.runway;
  if (terrain === 'beach') return PALETTE.sand;
  if (terrain === 'sea') {
    // Shallow water near shore, deep water out at sea.
    const near = world.groundHeightAt(x, z) > 0;
    return near ? PALETTE.seaShallow : PALETTE.seaDeep;
  }
  const kind = world.islandKindAt(x, z);
  const patch = world.patchAt(x, z);
  if (kind === 'fields') return patch < 0.5 ? PALETTE.fieldA : PALETTE.fieldB;
  if (kind === 'forest') return patch < 0.35 ? PALETTE.forest : PALETTE.grassB;
  if (kind === 'mountain') return patch < 0.3 ? PALETTE.rock : PALETTE.grassA;
  return patch < 0.5 ? PALETTE.grassA : PALETTE.grassB;
}

function drawGround(ctx, world, cam, plane, heading) {
  const horizonY = cam.horizonY;
  // Sea fills everything below the horizon first; land is painted over it.
  const sea = ctx.createLinearGradient(0, horizonY, 0, FIELD.height);
  sea.addColorStop(0, PALETTE.seaShallow);
  sea.addColorStop(1, PALETTE.seaDeep);
  ctx.fillStyle = sea;
  ctx.fillRect(0, horizonY, FIELD.width, FIELD.height - horizonY);

  // Ground strips, far to near. Each strip is a row of quads across the
  // visible lateral span; the far row is drawn first so the near row covers it.
  const zStart = Math.floor((plane.z + 30) / STRIP) * STRIP;
  const rows = Math.ceil(VIEW_DISTANCE / STRIP);
  for (let r = rows - 1; r >= 0; r -= 1) {
    const zFar = zStart + r * STRIP;
    const zNear = zFar + STRIP;
    const lateralSpan = 420;
    const step = 60;
    for (let x = -lateralSpan; x < lateralSpan; x += step) {
      const wx0 = plane.x + x;
      const wx1 = plane.x + x + step;
      const p00 = project(cam, wx0, world.groundHeightAt(wx0, zFar), zFar, heading);
      const p01 = project(cam, wx1, world.groundHeightAt(wx1, zFar), zFar, heading);
      const p10 = project(cam, wx0, world.groundHeightAt(wx0, zNear), zNear, heading);
      const p11 = project(cam, wx1, world.groundHeightAt(wx1, zNear), zNear, heading);
      if (!p00 || !p01 || !p10 || !p11) continue;
      const midX = plane.x + x + step / 2;
      const midZ = (zFar + zNear) / 2;
      const terrain = world.terrainAt(midX, midZ);
      if (terrain === 'sea') continue; // the sea fill already covers it
      ctx.fillStyle = groundColour(world, midX, midZ, terrain);
      ctx.beginPath();
      ctx.moveTo(p00.x, p00.y);
      ctx.lineTo(p01.x, p01.y);
      ctx.lineTo(p11.x, p11.y);
      ctx.lineTo(p10.x, p10.y);
      ctx.closePath();
      ctx.fill();
    }
  }

  drawRunway(ctx, world, cam, heading, plane);
}

function drawRunway(ctx, world, cam, heading, plane) {
  // The runway is painted as its own projected quad: the ground strips
  // sample the ground every 60 m, so a 28 m wide strip falls between
  // samples and never appears — the strip used to be invisible, with only
  // its number floating over the grass. Painting it explicitly keeps the
  // runway readable from the title screen to the final approach.
  // Everything here is wrapped in save/restore: the edge lines are sized
  // from the projection scale, which is huge when the plane sits on the
  // strip, and that lineWidth must never leak into the HUD drawn after.
  ctx.save();
  for (const runway of [world.homeRunway, world.farRunway]) {
    if (plane.z > runway.z1 + 200 || plane.z + VIEW_DISTANCE < runway.z0) continue;
    const half = world.runwayHalfWidth;
    // Clamp the near edge to just ahead of the camera, so a strip the plane
    // sits on still paints from the bottom of the screen.
    const zNear = Math.max(runway.z0, cam.z + 10);
    const zFar = runway.z1;
    const a = project(cam, runway.x - half, 2, zNear, heading);
    const b = project(cam, runway.x + half, 2, zNear, heading);
    const c = project(cam, runway.x + half, 2, zFar, heading);
    const d = project(cam, runway.x - half, 2, zFar, heading);
    if (a && b && c && d) {
      ctx.fillStyle = PALETTE.runway;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.lineTo(c.x, c.y);
      ctx.lineTo(d.x, d.y);
      ctx.closePath();
      ctx.fill();
      // Pale edge lines, so the strip reads against grass and sand.
      ctx.strokeStyle = 'rgba(244,246,248,0.85)';
      ctx.lineWidth = Math.max(1, Math.min(6, 1.4 * a.scale));
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(d.x, d.y);
      ctx.moveTo(b.x, b.y);
      ctx.lineTo(c.x, c.y);
      ctx.stroke();
      // Threshold bars at both ends.
      ctx.fillStyle = PALETTE.runwayMark;
      for (const zt of [runway.z0 + 12, runway.z1 - 12]) {
        const t0 = project(cam, runway.x - half + 2, 2.4, zt, heading);
        const t1 = project(cam, runway.x + half - 2, 2.4, zt, heading);
        const t2 = project(cam, runway.x + half - 2, 2.4, zt + 10, heading);
        const t3 = project(cam, runway.x - half + 2, 2.4, zt + 10, heading);
        if (!t0 || !t1 || !t2 || !t3) continue;
        ctx.beginPath();
        ctx.moveTo(t0.x, t0.y);
        ctx.lineTo(t1.x, t1.y);
        ctx.lineTo(t2.x, t2.y);
        ctx.lineTo(t3.x, t3.y);
        ctx.closePath();
        ctx.fill();
      }
    }
    // Centreline dashes and the runway number at the near threshold.
    ctx.fillStyle = PALETTE.runwayMark;
    for (let z = runway.z0 + 40; z < runway.z1 - 20; z += 90) {
      const p0 = project(cam, runway.x, 2.4, z, heading);
      const p1 = project(cam, runway.x, 2.4, z + 34, heading);
      if (!p0 || !p1) continue;
      // Close dashes grow huge in perspective and merge into a white blob
      // under the plane, so cap their width and skip the nearest ones.
      if (p0.forward < 120) continue;
      const w = Math.max(1.5, Math.min(8, 2.4 * p0.scale));
      ctx.fillRect(p0.x - w / 2, Math.min(p0.y, p1.y), w, Math.abs(p1.y - p0.y) + 1);
    }
    // Runway number at the near threshold.
    const num = project(cam, runway.x, 3, runway.z0 + 26, heading);
    if (num && num.forward < 1500) {
      ctx.save();
      ctx.fillStyle = PALETTE.runwayMark;
      // Capped: the projection scale explodes as the plane reaches the
      // threshold, and an uncapped number would fill the screen.
      ctx.font = `bold ${Math.max(10, Math.min(56, 26 * num.scale))}px ${'system-ui, sans-serif'}`;
      ctx.textAlign = 'center';
      ctx.fillText(runway.number, num.x, num.y);
      ctx.restore();
    }
  }
  ctx.restore();
}

function drawRing(ctx, cam, ring, heading, next) {
  const p = project(cam, ring.x, ring.y, ring.z, heading);
  if (!p || p.forward > VIEW_DISTANCE) return;
  // Flying through a hoop puts it on the camera plane, where its radius
  // explodes into a giant circle over the whole screen (it used to fill the
  // end screen). Skip hoops closer than the nose.
  if (p.forward < 50) return;
  const radius = 20 * p.scale;
  if (radius < 3) return;
  ctx.save();
  ctx.lineWidth = Math.max(2, radius * 0.16);
  ctx.strokeStyle = ring.passed ? PALETTE.ringPassed : PALETTE.ring;
  ctx.shadowColor = ring.passed ? PALETTE.ringPassed : PALETTE.ring;
  ctx.shadowBlur = next ? 18 : 8;
  ctx.beginPath();
  ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
  if (next) {
    ctx.save();
    ctx.fillStyle = PALETTE.ring;
    ctx.font = `bold ${Math.max(11, Math.min(20, radius * 0.5))}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(`RING ${ring.id}`, p.x, p.y - radius - 10);
    ctx.restore();
  }
}

function drawBeacon(ctx, cam, beacon, heading, active) {
  const p = project(cam, beacon.x, beacon.y, beacon.z, heading);
  if (!p || p.forward > VIEW_DISTANCE) return;
  const size = Math.max(5, 26 * p.scale);
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(Math.PI / 4);
  ctx.fillStyle = beacon.visited ? PALETTE.good : (active ? PALETTE.accent : '#c8d6e2');
  ctx.shadowColor = ctx.fillStyle;
  ctx.shadowBlur = active ? 16 : 6;
  ctx.fillRect(-size / 2, -size / 2, size, size);
  ctx.restore();
  ctx.save();
  ctx.fillStyle = '#ffffff';
  ctx.font = `bold ${Math.max(10, Math.min(16, size * 0.7))}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText(beacon.name, p.x, p.y - size - 6);
  ctx.restore();
}

function drawPlane(ctx, plane, time) {
  // Chase view from behind and slightly above: wings, tail and the glow of
  // the nav lights, rolling with the bank.
  const cx = FIELD.width / 2;
  const cy = FIELD.height * 0.8;
  const bob = Math.sin(time * 2.2) * 2;
  ctx.save();
  ctx.translate(cx, cy + bob);
  // Canvas rotation is clockwise for positive angles, and banking right is
  // a clockwise roll seen from behind, so the roll follows the bank sign.
  ctx.rotate(plane.bank * 0.9);
  // A touch larger than round 1, so the Skylark reads at a glance against
  // bright fields and sea instead of dissolving into them.
  const scale = plane.airborne ? 1.12 : 1.02;

  // Soft shadow on the ground far below is skipped: the plane is the camera's
  // subject, drawn crisp against the sky and sea.
  ctx.scale(scale, scale);

  // Wings, with a thin grey outline so they hold against bright grass.
  ctx.fillStyle = '#f2f5f7';
  ctx.beginPath();
  ctx.moveTo(-118, 6);
  ctx.lineTo(-14, -8);
  ctx.lineTo(14, -8);
  ctx.lineTo(118, 6);
  ctx.lineTo(104, 16);
  ctx.lineTo(-104, 16);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#8fa0ae';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = '#d63c2f';
  ctx.fillRect(-118, 6, 26, 7);
  ctx.fillRect(92, 6, 26, 7);

  // Fuselage, seen from the tail.
  const fus = ctx.createLinearGradient(0, -26, 0, 26);
  fus.addColorStop(0, '#ffffff');
  fus.addColorStop(0.6, '#e8eef2');
  fus.addColorStop(1, '#b9c6d0');
  ctx.fillStyle = fus;
  ctx.beginPath();
  ctx.moveTo(-13, -30);
  ctx.quadraticCurveTo(0, -38, 13, -30);
  ctx.lineTo(11, 18);
  ctx.quadraticCurveTo(0, 26, -11, 18);
  ctx.closePath();
  ctx.fill();

  // Tail fin and stabiliser.
  ctx.fillStyle = '#d63c2f';
  ctx.beginPath();
  ctx.moveTo(-9, -28);
  ctx.lineTo(0, -52);
  ctx.lineTo(9, -28);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#f2f5f7';
  ctx.beginPath();
  ctx.moveTo(-42, -18);
  ctx.lineTo(42, -18);
  ctx.lineTo(34, -10);
  ctx.lineTo(-34, -10);
  ctx.closePath();
  ctx.fill();

  // Engine cowling glow and the spinning prop disc, seen edge-on from behind.
  ctx.fillStyle = '#2c3644';
  ctx.fillRect(-7, -34, 14, 6);

  // Nav lights: red port, green starboard, white tail — they blink.
  const blink = Math.sin(time * 6) > 0;
  ctx.save();
  ctx.shadowBlur = 12;
  ctx.fillStyle = '#ff4d4d';
  ctx.shadowColor = '#ff4d4d';
  ctx.beginPath(); ctx.arc(-118, 9, blink ? 5 : 3, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#4dff88';
  ctx.shadowColor = '#4dff88';
  ctx.beginPath(); ctx.arc(118, 9, blink ? 5 : 3, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = '#ffffff';
  ctx.beginPath(); ctx.arc(0, -52, blink ? 4 : 2.5, 0, Math.PI * 2); ctx.fill();
  ctx.restore();

  // Registration on the tail.
  ctx.fillStyle = '#1d2733';
  ctx.font = 'bold 9px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('SKY-1', 0, -34);
  ctx.restore();
}

function nextRing(world) {
  return world.rings.find((ring) => !ring.passed) ?? null;
}

function nextBeacon(world, mission) {
  if (!mission || mission.def.id !== 'delivery') return null;
  return world.beacons.find((b) => b.id === mission.nextBeacon) ?? null;
}

/** Draw the whole flying scene. `view` carries camera + time. */
export function drawScene(ctx, world, plane, mission, view) {
  const { time } = view;
  const heading = plane.heading;
  // The camera sits just behind and above the plane, looking along the heading.
  const cam = {
    x: plane.x - Math.sin(heading) * 16,
    z: plane.z - Math.cos(heading) * 16,
    y: plane.y + 7,
    horizonY: FIELD.height * 0.46 - plane.pitch * 320,
  };

  skyGradient(ctx, cam.horizonY);
  drawSun(ctx, heading, time);
  drawRidge(ctx, world, heading, cam.horizonY);
  for (const cloud of world.clouds) drawCloud(ctx, cam, cloud, heading);
  drawGround(ctx, world, cam, plane, heading);

  const ring = nextRing(world);
  for (const r of world.rings) drawRing(ctx, cam, r, heading, r === ring);
  const beacon = nextBeacon(world, mission);
  for (const b of world.beacons) drawBeacon(ctx, cam, b, heading, b === beacon);

  // Off-screen pointer toward the next objective, so the pilot never hunts blind.
  // The objective depends on the sortie: rings, the next beacon, or the far
  // runway when the sortie ends with a landing.
  let target = null;
  let targetLabel = '';
  if (mission && mission.def.id === 'landing') {
    target = { x: 0, y: 20, z: world.farRunway.z0 + 260 };
    targetLabel = 'NORTH ISLE RUNWAY';
  } else if (ring) {
    target = ring;
    targetLabel = `NEXT RING ${ring.id}`;
  } else if (beacon) {
    target = beacon;
    targetLabel = `NEXT: ${beacon.name}`;
  } else if (mission && mission.def.id === 'delivery') {
    target = { x: 0, y: 20, z: world.farRunway.z0 + 260 };
    targetLabel = 'NORTH ISLE RUNWAY';
  }
  if (target) {
    const p = project(cam, target.x, target.y, target.z, heading);
    if (!p || p.x < 60 || p.x > FIELD.width - 60 || p.y < 60 || p.y > FIELD.height - 200) {
      const dx = target.x - plane.x;
      const dz = target.z - plane.z;
      const bearing = Math.atan2(dx, dz) - heading;
      const ax = FIELD.width / 2 + Math.sin(bearing) * 300;
      ctx.save();
      ctx.fillStyle = PALETTE.accent;
      ctx.font = 'bold 15px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${bearing > 0 ? '▶' : '◀'} ${targetLabel}`, Math.max(90, Math.min(FIELD.width - 90, ax)), 108);
      ctx.restore();
    }
  }

  drawPlane(ctx, plane, time);
}
