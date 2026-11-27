// The HUD and the lit instrument cluster: altitude, speed and heading on
// the top bar, a compass strip, throttle / fuel / damage gauges, and an
// artificial horizon with altimeter and speed dials at the bottom. Everything
// is drawn on the canvas, so the instruments are part of the game itself.

import { FIELD, FONT, PALETTE } from './config.js';
import { feet, headingDegrees, knots } from './physics.js';

const DEG = Math.PI / 180;

function panel(ctx, x, y, w, h) {
  ctx.save();
  // Solid, not translucent: the bright sun used to show through the panel
  // as a dark disc wherever it sat behind the HUD.
  ctx.fillStyle = PALETTE.panel;
  ctx.strokeStyle = PALETTE.panelEdge;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 8);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function label(ctx, text, x, y, color = PALETTE.muted, size = 11) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.font = `600 ${size}px ${FONT}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(text, x, y);
  ctx.restore();
}

function readout(ctx, text, x, y, size = 24) {
  ctx.save();
  ctx.fillStyle = PALETTE.text;
  ctx.font = `700 ${size}px ${FONT}`;
  ctx.textAlign = 'left';
  ctx.fillText(text, x, y);
  ctx.restore();
}

function bar(ctx, x, y, w, h, fraction, colour, lit = true) {
  ctx.save();
  ctx.fillStyle = '#0a0e13';
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 4);
  ctx.fill();
  ctx.fillStyle = colour;
  if (lit) {
    ctx.shadowColor = colour;
    ctx.shadowBlur = 10;
  }
  const fw = Math.max(0, Math.min(1, fraction)) * w;
  if (fw > 2) {
    ctx.beginPath();
    ctx.roundRect(x, y, fw, h, 4);
    ctx.fill();
  }
  ctx.restore();
}

function dial(ctx, cx, cy, radius, value, max, unit, ticks) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.fillStyle = 'rgba(10,14,19,0.9)';
  ctx.strokeStyle = PALETTE.panelEdge;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // Lit tick ring.
  ctx.strokeStyle = '#cfe3ef';
  ctx.shadowColor = '#9fd8ff';
  ctx.shadowBlur = 6;
  for (let i = 0; i <= ticks; i += 1) {
    const a = -Math.PI * 0.75 + (i / ticks) * Math.PI * 1.5;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * (radius - 4), Math.sin(a) * (radius - 4));
    ctx.lineTo(Math.cos(a) * (radius - 11), Math.sin(a) * (radius - 11));
    ctx.stroke();
  }
  // Needle.
  const angle = -Math.PI * 0.75 + (Math.max(0, Math.min(1, value / max))) * Math.PI * 1.5;
  ctx.strokeStyle = PALETTE.accent;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(Math.cos(angle) * (radius - 14), Math.sin(angle) * (radius - 14));
  ctx.stroke();
  ctx.fillStyle = PALETTE.text;
  ctx.font = `700 15px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.shadowBlur = 0;
  ctx.fillText(unit, 0, radius * 0.52);
  ctx.restore();
}

function artificialHorizon(ctx, cx, cy, radius, bank, pitch) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.clip();
  ctx.translate(cx, cy);
  ctx.rotate(-bank);
  const pitchPx = pitch * radius * 1.4;
  ctx.fillStyle = '#3f8fd2';
  ctx.fillRect(-radius, -radius + pitchPx, radius * 2, radius);
  ctx.fillStyle = '#7a5a34';
  ctx.fillRect(-radius, pitchPx, radius * 2, radius);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-radius, pitchPx);
  ctx.lineTo(radius, pitchPx);
  ctx.stroke();
  ctx.restore();
  // Fixed wings and bezel.
  ctx.save();
  ctx.translate(cx, cy);
  ctx.strokeStyle = PALETTE.accent;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-radius * 0.55, 0);
  ctx.lineTo(-radius * 0.18, 0);
  ctx.moveTo(radius * 0.18, 0);
  ctx.lineTo(radius * 0.55, 0);
  ctx.stroke();
  ctx.strokeStyle = PALETTE.panelEdge;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function compassStrip(ctx, headingDeg) {
  const cx = FIELD.width / 2;
  const y = 54;
  ctx.save();
  ctx.fillStyle = PALETTE.panel;
  ctx.beginPath();
  ctx.roundRect(cx - 190, y - 16, 380, 30, 8);
  ctx.fill();
  ctx.strokeStyle = PALETTE.panelEdge;
  ctx.stroke();
  ctx.beginPath();
  ctx.rect(cx - 190, y - 16, 380, 30);
  ctx.clip();
  const points = [
    [0, 'N'], [45, 'NE'], [90, 'E'], [135, 'SE'],
    [180, 'S'], [225, 'SW'], [270, 'W'], [315, 'NW'],
  ];
  ctx.font = `700 13px ${FONT}`;
  ctx.textAlign = 'center';
  for (let deg = 0; deg < 360; deg += 15) {
    let rel = ((deg - headingDeg + 540) % 360) - 180;
    const x = cx + rel * 3.2;
    if (x < cx - 190 || x > cx + 190) continue;
    const major = deg % 45 === 0;
    ctx.strokeStyle = major ? PALETTE.text : PALETTE.muted;
    ctx.beginPath();
    ctx.moveTo(x, y + 2);
    ctx.lineTo(x, y + (major ? 12 : 8));
    ctx.stroke();
    const point = points.find(([d]) => d === deg);
    if (point) {
      ctx.fillStyle = deg === 0 ? PALETTE.accent : PALETTE.text;
      ctx.fillText(point[1], x, y - 2);
    }
  }
  ctx.restore();
  // Centre lubber line.
  ctx.save();
  ctx.fillStyle = PALETTE.accent;
  ctx.beginPath();
  ctx.moveTo(cx - 6, y - 18);
  ctx.lineTo(cx + 6, y - 18);
  ctx.lineTo(cx, y - 8);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/** Draw the HUD over the flying scene. */
export function drawHud(ctx, plane, mission, elapsed, view) {
  const speedKt = Math.round(knots(plane));
  const altFt = Math.round(feet(plane));
  const hdg = Math.round(headingDegrees(plane));

  // Top bar: ALT / SPD / HDG readouts, compass, mission goal, score.
  panel(ctx, 14, 10, 300, 62);
  label(ctx, 'ALTITUDE', 26, 28);
  readout(ctx, `${altFt.toLocaleString('en-US')} ft`, 26, 56);
  label(ctx, 'SPEED', 150, 28);
  readout(ctx, `${speedKt} kt`, 150, 56);
  label(ctx, 'HEADING', 238, 28);
  readout(ctx, `${String(hdg).padStart(3, '0')}°`, 238, 56);

  compassStrip(ctx, hdg);

  panel(ctx, FIELD.width - 314, 10, 300, 78);
  label(ctx, mission.def.name, FIELD.width - 302, 28, PALETTE.accent, 12);
  readout(ctx, mission.goalText(), FIELD.width - 302, 54, 19);
  label(ctx, `SCORE ${mission.score}`, FIELD.width - 302, 72, PALETTE.text, 12);
  const mm = Math.floor(elapsed / 60);
  const ss = String(Math.floor(elapsed % 60)).padStart(2, '0');
  label(ctx, `${mm}:${ss}`, FIELD.width - 60, 28, PALETTE.muted, 12);

  // Left gauges: throttle and fuel.
  panel(ctx, 14, 84, 150, 118);
  label(ctx, 'THROTTLE', 26, 102);
  bar(ctx, 26, 110, 126, 12, plane.throttle, '#7ec8ff');
  label(ctx, `${Math.round(plane.throttle * 100)}%`, 26, 140, PALETTE.text, 13);
  label(ctx, 'FUEL', 26, 162);
  const fuelColour = plane.fuel <= FUEL_LOW ? PALETTE.danger : (plane.fuel <= 40 ? PALETTE.warn : PALETTE.good);
  bar(ctx, 26, 170, 126, 12, plane.fuel / 100, fuelColour);
  label(ctx, `${Math.round(plane.fuel)}%`, 26, 196 - 4 + 4, plane.fuel <= FUEL_LOW ? PALETTE.danger : PALETTE.text, 13);

  // Right gauges: damage and vertical speed.
  panel(ctx, FIELD.width - 164, 84, 150, 118);
  label(ctx, 'AIRFRAME', FIELD.width - 152, 102);
  bar(ctx, FIELD.width - 152, 110, 126, 12, plane.damage / 100, plane.damage > 60 ? PALETTE.danger : PALETTE.good);
  label(ctx, `${Math.round(plane.damage)}% dmg`, FIELD.width - 152, 140, PALETTE.text, 13);
  label(ctx, 'VERT SPEED', FIELD.width - 152, 162);
  const vs = Math.round(plane.verticalSpeed * 196.85);
  label(ctx, `${vs >= 0 ? '+' : ''}${vs} ft/min`, FIELD.width - 152, 186, Math.abs(vs) > 800 ? PALETTE.warn : PALETTE.text, 13);
  label(ctx, plane.gearDown ? 'GEAR DOWN' : 'GEAR UP', FIELD.width - 152, 204 - 4, plane.gearDown ? PALETTE.good : PALETTE.muted, 11);

  // Instrument cluster along the bottom.
  panel(ctx, FIELD.width / 2 - 190, FIELD.height - 96, 380, 88);
  artificialHorizon(ctx, FIELD.width / 2 - 128, FIELD.height - 52, 32, plane.bank, plane.pitch);
  label(ctx, 'ATTITUDE', FIELD.width / 2 - 152, FIELD.height - 10, PALETTE.muted, 10);
  dial(ctx, FIELD.width / 2 - 40, FIELD.height - 52, 32, altFt, 5000, 'ALT', 5);
  dial(ctx, FIELD.width / 2 + 52, FIELD.height - 52, 32, speedKt, 240, 'KT', 6);
  const stall = plane.speed < 30 && plane.airborne;
  label(ctx, stall ? 'STALL' : 'SKYLARK', FIELD.width / 2 + 104, FIELD.height - 48, stall ? PALETTE.danger : PALETTE.muted, 11);
  label(ctx, plane.airborne ? 'AIRBORNE' : 'ON GROUND', FIELD.width / 2 + 104, FIELD.height - 30, PALETTE.text, 11);

  // Toast message under the compass.
  if (mission.toast && view.time < view.toastUntil) {
    ctx.save();
    ctx.font = `700 19px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.shadowColor = '#000';
    ctx.shadowBlur = 8;
    ctx.fillStyle = PALETTE.accent;
    ctx.fillText(mission.toast, FIELD.width / 2, 118);
    ctx.restore();
  }
}

const FUEL_LOW = 25;

/** Title screen: the game name, the three sorties and the controls. */
export function drawTitle(ctx, missions, selected, best) {
  ctx.save();
  ctx.fillStyle = 'rgba(8,12,18,0.55)';
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  ctx.textAlign = 'center';
  ctx.fillStyle = PALETTE.text;
  ctx.font = `800 64px ${FONT}`;
  ctx.shadowColor = '#1a5a8a';
  ctx.shadowBlur = 30;
  ctx.fillText('SKYLARK ISLES', FIELD.width / 2, 150);
  ctx.shadowBlur = 0;
  ctx.fillStyle = PALETTE.accent;
  ctx.font = `600 20px ${FONT}`;
  ctx.fillText('A little prop plane, a chain of islands, and a sky full of decisions', FIELD.width / 2, 186);
  ctx.restore();

  missions.forEach((def, index) => {
    const y = 250 + index * 96;
    const chosen = index === selected;
    ctx.save();
    ctx.fillStyle = chosen ? 'rgba(255,201,60,0.16)' : PALETTE.panel;
    ctx.strokeStyle = chosen ? PALETTE.accent : PALETTE.panelEdge;
    ctx.lineWidth = chosen ? 2 : 1;
    ctx.beginPath();
    ctx.roundRect(FIELD.width / 2 - 330, y, 660, 80, 10);
    ctx.fill();
    ctx.stroke();
    ctx.textAlign = 'left';
    ctx.fillStyle = chosen ? PALETTE.accent : PALETTE.text;
    ctx.font = `700 22px ${FONT}`;
    ctx.fillText(`${def.key}. ${def.name}`, FIELD.width / 2 - 308, y + 32);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `400 15px ${FONT}`;
    ctx.fillText(def.short, FIELD.width / 2 - 308, y + 58);
    ctx.restore();
  });

  ctx.save();
  ctx.textAlign = 'center';
  ctx.fillStyle = PALETTE.text;
  ctx.font = `500 15px ${FONT}`;
  ctx.fillText('W/S throttle · ↑/↓ pitch · ←/→ or A/D bank · mouse steers · G gear · P pause · R restart', FIELD.width / 2, 648);
  ctx.fillStyle = PALETTE.muted;
  ctx.fillText('Press 1, 2 or 3 to pick a sortie, then Space or click to fly.', FIELD.width / 2, 674);
  if (best > 0) {
    ctx.fillStyle = PALETTE.accent;
    ctx.fillText(`Best score: ${best}`, FIELD.width / 2, 704);
  }
  ctx.restore();
}

/** End screen: mission complete, crashed, or out of fuel on the ground. */
export function drawEnd(ctx, mission, plane, best) {
  ctx.save();
  ctx.fillStyle = 'rgba(8,12,18,0.62)';
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  ctx.textAlign = 'center';
  ctx.fillStyle = mission.failed ? PALETTE.danger : PALETTE.accent;
  ctx.font = `800 52px ${FONT}`;
  ctx.fillText(mission.endReason || 'SORTIE OVER', FIELD.width / 2, 240);
  ctx.fillStyle = PALETTE.text;
  ctx.font = `600 24px ${FONT}`;
  ctx.fillText(`Score: ${mission.score}`, FIELD.width / 2, 296);
  ctx.fillStyle = PALETTE.muted;
  ctx.font = `400 17px ${FONT}`;
  ctx.fillText(`Rings ${mission.ringsFlown}/12 · Beacons ${mission.beaconsVisited}/3 · Fuel ${Math.round(plane.fuel)}% left`, FIELD.width / 2, 330);
  if (mission.score >= best && mission.score > 0) {
    ctx.fillStyle = PALETTE.accent;
    ctx.fillText('New best score!', FIELD.width / 2, 362);
  }
  ctx.fillStyle = PALETTE.text;
  ctx.font = `500 16px ${FONT}`;
  ctx.fillText('Press R or Space to fly again · 1/2/3 to change sortie', FIELD.width / 2, 420);
  ctx.restore();
}

/** Pause overlay. */
export function drawPaused(ctx) {
  ctx.save();
  ctx.fillStyle = 'rgba(8,12,18,0.55)';
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  ctx.textAlign = 'center';
  ctx.fillStyle = PALETTE.text;
  ctx.font = `800 44px ${FONT}`;
  ctx.fillText('PAUSED', FIELD.width / 2, FIELD.height / 2 - 10);
  ctx.font = `400 17px ${FONT}`;
  ctx.fillStyle = PALETTE.muted;
  ctx.fillText('P or Esc to resume · R to restart the sortie', FIELD.width / 2, FIELD.height / 2 + 26);
  ctx.restore();
}
