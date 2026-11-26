// The three sorties. Each one is a different goal over the same island
// chain, with its own win condition and its own way to score, so a flight is
// a decision — throttle, route and fuel — rather than a straight line.

import { BEACON, LANDING_SCORE, RING } from './config.js';

export const MISSIONS = [
  {
    id: 'rings',
    key: 1,
    name: 'RING RUN',
    short: 'Fly all 12 golden rings',
    brief: 'Twelve golden rings thread the island chain, climbing over the mountain isle. Thread every one before the tanks run dry — full throttle drinks fuel, so fly clean and bank smooth.',
    goal: 'Rings 0/12',
    winText: 'ALL RINGS FLOWN',
  },
  {
    id: 'landing',
    key: 2,
    name: 'ISLAND LANDING',
    short: 'Land on the North Isle strip',
    brief: 'Take off from Meridian, fly the course north and put her down on the North Isle strip. Come in slow, wings level, gear down — a hard or fast touchdown bends the airframe.',
    goal: 'Land on North Isle',
    winText: 'TOUCHDOWN — WELCOME TO NORTH ISLE',
  },
  {
    id: 'delivery',
    key: 3,
    name: 'BEACON DELIVERY',
    short: 'Visit all 3 beacons, then land',
    brief: 'Three beacons wait along the chain: the Harbour, the Lighthouse and the Mountain Pass. Log each one in order, then land on the North Isle strip to finish the delivery.',
    goal: 'Beacons 0/3',
    winText: 'DELIVERY COMPLETE',
  },
];

export function createMission(def) {
  const mission = {
    def,
    ringsFlown: 0,
    beaconsVisited: 0,
    score: 0,
    done: false,
    failed: false,
    endReason: '',
    toast: '',
    toastUntil: 0,
    nextBeacon: 1,

    goalText() {
      if (def.id === 'rings') return `Rings ${mission.ringsFlown}/12`;
      if (def.id === 'landing') return 'Land on North Isle';
      return `Beacons ${mission.beaconsVisited}/3`;
    },

    /** Score and progress from the flight model's event names. */
    noteEvents(events, plane) {
      for (const event of events) {
        if (event.startsWith('ring:')) {
          mission.ringsFlown += 1;
          mission.score += RING.score;
          mission.toast = `RING ${mission.ringsFlown}/12  +${RING.score}`;
          if (def.id === 'rings' && mission.ringsFlown >= 12) {
            mission.done = true;
            mission.endReason = def.winText;
            mission.score += Math.round(plane.fuel) * 10;
          }
        } else if (event.startsWith('beacon:')) {
          const id = Number(event.split(':')[1]);
          if (def.id === 'delivery' && id === mission.nextBeacon) {
            mission.beaconsVisited += 1;
            mission.nextBeacon += 1;
            mission.score += BEACON.score;
            mission.toast = `BEACON ${mission.beaconsVisited}/3 LOGGED  +${BEACON.score}`;
          } else if (def.id === 'delivery') {
            mission.toast = 'WRONG BEACON — FOLLOW THE ORDER';
          } else {
            mission.score += BEACON.score;
            mission.toast = `BEACON LOGGED  +${BEACON.score}`;
          }
        } else if (event === 'landed' || event === 'hard-landing') {
          const fuelBonus = Math.round(plane.fuel) * 5;
          if (def.id === 'landing') {
            mission.done = true;
            mission.endReason = event === 'landed' ? def.winText : 'LANDED — HARD, BUT DOWN';
            mission.score += LANDING_SCORE + fuelBonus;
          } else if (def.id === 'delivery' && mission.beaconsVisited >= 3) {
            mission.done = true;
            mission.endReason = def.winText;
            mission.score += LANDING_SCORE + fuelBonus;
          } else {
            mission.score += 250 + fuelBonus;
            mission.toast = 'LANDED — SORTIE OVER';
            mission.done = true;
            mission.endReason = 'LANDED SAFELY';
          }
          if (event === 'hard-landing') mission.toast = 'HARD LANDING — AIRFRAME DAMAGED';
        } else if (event === 'crashed') {
          mission.failed = true;
          mission.endReason = 'CRASHED';
        } else if (event === 'stall') {
          mission.toast = 'STALL — NOSE DOWN, POWER UP';
        } else if (event === 'fuel-low') {
          mission.toast = 'FUEL LOW — PLAN YOUR LANDING';
        } else if (event === 'fuel-out') {
          mission.toast = 'FUEL EMPTY — DEAD-STICK GLIDE';
        } else if (event === 'takeoff') {
          mission.toast = 'AIRBORNE — GEAR UP WHEN READY';
        }
      }
    },
  };
  return mission;
}
