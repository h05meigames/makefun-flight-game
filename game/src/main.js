// Skylark Isles — boot, the fixed-step loop, and the screens. The game runs
// at a fixed 60 Hz simulation whatever the display's rate, draws the chase
// view and the HUD every frame, and keeps one small piece of state the
// screenshot tooling and the play-test read back: window.__skylark.

import { BEST_KEY, FIELD, STEP } from './config.js';
import { createAudio } from './audio.js';
import { drawEnd, drawHud, drawPaused, drawTitle } from './hud.js';
import { ACTION_CONFIRM, ACTION_GEAR, ACTION_PAUSE, ACTION_RESTART, createInput } from './input.js';
import { createMission, MISSIONS } from './missions.js';
import { createPlane, stepFlight } from './physics.js';
import { drawScene } from './render.js';
import { stageShot } from './shots.js';
import { createWorld } from './world.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');

const input = createInput(canvas);
const audio = createAudio();
const world = createWorld();

const game = {
  world,
  plane: createPlane(),
  mission: createMission(MISSIONS[0]),
  screen: 'title',
  selectedMission: 0,
  elapsed: 0,
  time: 0,
  best: 0,
  toastUntil: 0,
  lastToast: '',
};

try {
  game.best = Number(localStorage.getItem(BEST_KEY) ?? 0) || 0;
} catch {
  game.best = 0;
}

function saveBest() {
  try {
    localStorage.setItem(BEST_KEY, String(game.best));
  } catch {
    // A browser that refuses storage still plays fine.
  }
}

function startSortie(missionIndex) {
  world.reset();
  game.plane = createPlane();
  game.mission = createMission(MISSIONS[missionIndex]);
  game.selectedMission = missionIndex;
  game.elapsed = 0;
  game.screen = 'flying';
  game.toastUntil = 0;
  game.lastToast = '';
  audio.unlock();
  audio.click();
  announce(`${game.mission.def.name}. ${game.mission.def.brief}`);
}

function endSortie() {
  game.screen = 'end';
  if (game.mission.score > game.best) {
    game.best = game.mission.score;
    saveBest();
  }
  announce(`${game.mission.endReason}. Score ${game.mission.score}.`);
}

function announce(text) {
  if (statusEl) statusEl.textContent = text;
}

/** One fixed simulation step while flying. */
function stepGame() {
  const plane = game.plane;
  const mission = game.mission;

  const mouse = input.mouseSteer();
  const keys = { bank: input.bankDirection(), pitch: input.pitchDirection() };
  // Keys bank and pitch; the mouse banks and pitches. Keys never fight the
  // mouse: whichever steers wins, and the stick centres when neither does.
  let steer;
  if (mouse) {
    steer = { bank: mouse.bank, pitch: mouse.pitch };
  } else {
    steer = { bank: keys.bank, pitch: keys.pitch };
  }
  const throttleDelta = input.throttleDirection();

  const events = stepFlight(plane, world, mission, steer, throttleDelta, STEP);
  game.elapsed += STEP;

  if (mission.toast && mission.toast !== game.lastToast) {
    game.lastToast = mission.toast;
    game.toastUntil = game.time + 2.6;
    announce(mission.toast);
  }
  if (events.includes('ring')) audio.ring();
  if (events.some((e) => e.startsWith('beacon:'))) audio.beacon();
  if (events.includes('landed')) audio.landing();
  if (events.includes('hard-landing')) audio.landing();
  if (events.includes('crashed')) audio.crash();
  audio.update(plane.throttle, plane.speed, plane.airborne);

  if (mission.done || mission.failed) endSortie();
}

function render() {
  ctx.clearRect(0, 0, FIELD.width, FIELD.height);
  drawScene(ctx, world, game.plane, game.mission, { time: game.time, toastUntil: game.toastUntil });
  if (game.screen === 'title') {
    drawTitle(ctx, MISSIONS, game.selectedMission, game.best);
  } else if (game.screen === 'flying' || game.screen === 'paused') {
    drawHud(ctx, game.plane, game.mission, game.elapsed, { time: game.time, toastUntil: game.toastUntil });
    if (game.screen === 'paused') drawPaused(ctx);
  } else if (game.screen === 'end') {
    drawHud(ctx, game.plane, game.mission, game.elapsed, { time: game.time, toastUntil: game.toastUntil });
    drawEnd(ctx, game.mission, game.plane, game.best);
  }
}

let last = performance.now();
let accumulator = 0;

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  game.time += dt;

  const actions = input.takeActions();
  const missionKey = input.takeMissionKey();

  if (game.screen === 'title') {
    if (missionKey >= 1 && missionKey <= 3) {
      game.selectedMission = missionKey - 1;
      audio.unlock();
      audio.click();
    } else if (actions & ACTION_CONFIRM) {
      startSortie(game.selectedMission);
    }
    // Idle on the runway: the engine ticks over, the world stays put.
    game.plane.throttle = 0.22;
  } else if (game.screen === 'flying') {
    if (actions & ACTION_PAUSE) {
      game.screen = 'paused';
    } else if (actions & ACTION_GEAR) {
      game.plane.gearDown = !game.plane.gearDown;
      announce(game.plane.gearDown ? 'Gear down.' : 'Gear up.');
    } else if (actions & ACTION_RESTART) {
      startSortie(game.selectedMission);
    } else {
      accumulator += dt;
      while (accumulator >= STEP) {
        stepGame();
        accumulator -= STEP;
        if (game.screen !== 'flying') break;
      }
    }
  } else if (game.screen === 'paused') {
    if (actions & ACTION_PAUSE) game.screen = 'flying';
    else if (actions & ACTION_RESTART) startSortie(game.selectedMission);
  } else if (game.screen === 'end') {
    if (missionKey >= 1 && missionKey <= 3) {
      startSortie(missionKey - 1);
    } else if (actions & (ACTION_CONFIRM | ACTION_RESTART)) {
      startSortie(game.selectedMission);
    }
  }

  render();
}

// Screenshot mode: stage one fixed scene, render it once, and stop. No loop,
// so the shot is exactly the staged frame.
const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
if (shot) {
  const staged = stageShot(shot, game);
  game.screen = staged.screen;
  game.best = staged.best;
  game.time = 12;
  game.toastUntil = 0;
  render();
} else {
  requestAnimationFrame(frame);
}

// Read back by the play-test and the screenshot script: screen, plane,
// mission progress and score, live.
window.__skylark = {
  get screen() { return game.screen; },
  get plane() { return game.plane; },
  get mission() {
    return {
      name: game.mission.def.name,
      score: game.mission.score,
      rings: game.mission.ringsFlown,
      beacons: game.mission.beaconsVisited,
      done: game.mission.done,
      failed: game.mission.failed,
    };
  },
  get elapsed() { return game.elapsed; },
  startSortie,
};
