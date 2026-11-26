[![Bounty](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)
[![Rank](https://make.fun/badge/best-flight-game-20261126-0057/h05meigames/makefun-flight-game/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)
[![Reward](https://make.fun/badge/best-flight-game-20261126-0057/h05meigames/makefun-flight-game/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)

# Skylark Isles

A little prop plane, a chain of islands, and a sky full of decisions. Built for [make.fun's best flight game bounty](https://make.fun/bounty/best-flight-game-20261126-0057) — $500 pool, top 50 share.

Fly the Skylark, a small red-and-white prop plane, over the Meridian island chain in a pseudo-3D chase view: green fields and patchwork farmland, sandy beaches, a mountain isle with snow-capped peaks, open sea, and two runways — Meridian 09 at the south end and North Isle 27 at the north. The HUD shows altitude, speed and heading on the top bar, a compass strip, throttle and fuel gauges, airframe damage, vertical speed, and a lit instrument cluster with an artificial horizon, altimeter and speed dials.

## Three sorties

Pick one on the title screen (keys 1, 2, 3), then Space or click to fly.

1. **Ring Run** — thread all 12 golden rings along the course before the tanks run dry. Full throttle drinks fuel, so fly clean and bank smooth.
2. **Island Landing** — take off from Meridian, fly the course north, and put her down on the North Isle strip. Come in slow, wings level, gear down: a hard or fast touchdown bends the airframe.
3. **Beacon Delivery** — log the Harbour, Lighthouse and Mountain Pass beacons in order, then land on the North Isle strip to finish the delivery.

Fuel burns with the throttle and damage accumulates on hard touchdowns, so every sortie is a decision about speed, route and reserves. Landings and crashes read as what happened: a gentle touchdown on the centreline ends the sortie with a score bonus, anything else ends it in the sea or the hillside.

## Controls

- **W / S** — throttle up / down
- **↑ / ↓** — pitch up / down (pull back to rotate on takeoff)
- **← / → or A / D** — bank left / right
- **Mouse** — move to steer (bank + pitch)
- **G** — landing gear up / down
- **P or Esc** — pause · **R** — restart the sortie

## Play it

No build step, no network requests: every file the game loads lives under `game/`.

```sh
node serve.ts
# open http://localhost:8080
```

## Layout

- `game/index.html` — the page; `game/src/main.js` — boot, loop and screens
- `game/src/config.js` — tuning numbers and palette
- `game/src/world.js` — the island chain, runways, rings, beacons, clouds
- `game/src/physics.js` — the flight model: throttle, bank, turn, climb, stall, fuel, landings and crashes
- `game/src/render.js` — the chase-view renderer: sky, sea, terrain strips, rings, the Skylark
- `game/src/hud.js` — HUD, compass, gauges and the lit instrument cluster
- `game/src/missions.js` — the three sorties and their scoring
- `game/src/input.js` — keyboard and mouse
- `game/src/audio.js` — synthesised engine, wind and chimes (WebAudio, no audio files)
- `game/src/shots.js` — repeatable screenshot scenes
- `main.ts` — hands the game in: copies `game/` and `screenshots/` to `/output` and writes `dossier.json`

## Referral

https://make.fun/r/0ene8b3q

## License

MIT — see [LICENSE](LICENSE).
