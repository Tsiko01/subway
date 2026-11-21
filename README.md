# NOCTURNE — Rail Runner

A 3D endless rail runner for the browser. Dodge trains, outrun the transit officer, collect coins, and spend them on characters, skateboards, upgrades and new maps.

Built with React and Vite. The 3D scene uses Three.js via React Three Fiber, drei and postprocessing; the UI uses Framer Motion, Tailwind CSS and Lucide icons; game state lives in zustand.

Nothing is downloaded at runtime: the characters, trains, scenery, textures, music and sound effects are all generated in code.

## Run

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production bundle in dist/
npm run preview  # serve the production build
```

## Controls

| Action | Keyboard | Touch |
| --- | --- | --- |
| Change lane | ← → / A D | swipe left / right |
| Jump | ↑ / W / Space | swipe up |
| Slide (dives when airborne) | ↓ / S | swipe down |
| Ride a skateboard | E or B | double-tap, or the board button |
| Jet launch (consumable) | Q | jet button |
| Pause / back | Esc / P | pause button |
| Start / retry | Enter | Play button |

## Gameplay

- **Lanes and obstacles.** The track has three rail lanes. Low barriers, traffic cones and roadblocks must be jumped. Overhead signs, gantries and pipes must be slid under. Electrical boxes, walls and containers must be dodged.
- **Trains.**
  - Parked trains block their lane, but some have a ramp: run up it and keep going along the roofs, switching between trains.
  - Oncoming trains have headlights. Their lane is kept clear for a stretch beforehand so you have time to see them coming.
- **Fairness.** The pattern generator checks every section so there is always a reachable lane.
- **Crashes vs stumbles.** Running head-on into a train or a wall ends the run. Clipping a small obstacle, or bumping a train from the side, is a *stumble*: you slow down and the officer catches up. Stumble again while he is close and you're caught.
- **The officer.** He chases you at the start of every run, then falls back. He sprints in after a stumble, blowing his whistle, and hops or ducks obstacles and changes lanes around trains on his way. On a second mistake he grabs you. If you crash on your own, he walks up and stands over you.

### Power-ups

| Power-up | Effect |
| --- | --- |
| **Coin Magnet** | Pulls nearby coins to you. |
| **Spring Sneakers** | Much higher jumps with a front flip — high enough to clear whole trains. |
| **Jetpack** | Fly above the rails. A trail of sky coins collects itself, and you land with a short protected descent. |
| **2× Score** | Doubles every point you earn. |
| **Shield Board** | A free skateboard ride that absorbs one crash. |

Each power-up's duration can be upgraded 5 levels in the shop.

### Skateboards

- **Riding.** Boards are a consumable inventory. Activate one at any time; it lasts its full duration or until it absorbs one crash or stumble. You ride in a sideways stance, kickflip on jumps and spark on landings.
- **Designs.** There are 8 designs (Street Classic, Neon Pulse, Sunset Cruiser, Camo Ops, Ocean Wave, Carbon Strike, Galaxy Drift, Golden Rush). Buy and equip them in Shop → Boards.

## Progression

- **Coins** are collected during runs and banked when the run ends, including when you quit from the pause menu.
- **Characters.** There are 12 skins, each with its own outfit, colours, running style and emote: Nova, Midnight, Rex, Kai, Juno, Tidal, Patrol, Sakura, Neon, Ghost, Vector and Aurum. Locked skins show their price, a skin can't be bought twice, and the equipped skin is saved.
- **Maps.** There are 5, each with its own sky, lighting, scenery, trains, obstacle mix and soundtrack:

  | Map | Unlock (level or coins) |
  | --- | --- |
  | City Subway | free |
  | Modern City | level 3 or 1,500 |
  | Industrial Zone | level 6 or 3,000 |
  | Beach Line | level 9 or 5,000 |
  | Night City | level 12 or 8,000 |

- **Missions.** Three are active at a time; they pay coins and XP the moment they're completed and are replaced by harder ones.
- **Levels.** XP comes from distance, coins and missions. Each level raises your score multiplier (up to ×30) and gives coins, plus a skateboard every third level.
- **Achievements.** 15 lifetime goals, each with a coin reward.
- **Daily rewards.** A 7-day streak calendar.

All progress is saved in `localStorage`. Settings → Reset progress wipes it.

## Graphics tiers

- **Cinematic:** wet-street reflections (Night City), HDR bloom, MSAA, 2048 px shadows.
- **Balanced:** HDR bloom, 1024 px shadows.
- **Performance:** no post-processing, capped resolution. Used by default on phones.

The starting tier is picked from the device. If the frame rate stays low, the game steps down automatically unless the player chose a tier in Settings.

While the intro plays, every shader is compiled in parallel and every texture and buffer is uploaded, so nothing stalls the first time a train, pickup or the officer appears.

## Structure

```
src/
  game/
    constants.js    tuning values
    maps.js         the 5 environments
    catalog.js      skins, boards, items, upgrades
    progression.js  missions, achievements, levels, daily rewards
    store.js        persistent profile, shop, runs, settings (zustand)
    runtime.js      per-frame simulation state (never React state)
    rules.js        collisions → crash / stumble / caught, power-up activation
    audio.js        generative soundtrack per map + all sound effects
    input.js        keyboard, swipes, double-tap
    textures.js     procedural textures
    atmosphere.js   per-map palette blending
  scene/
    character/      procedural humanoid rig (outfits) + pose library
    Player.jsx      runner controller and animation
    Officer.jsx     the chasing officer
    Spawner.jsx     trains, ramps, obstacles, coins, power-ups, collisions
    prefabs.js      merged-geometry models for everything above
    Scenery.jsx     instanced, recycled scenery for every map
    World.jsx       track, rails, wires, sky, water, lights
    GameCanvas.jsx  canvas, shader warm-up, quality tiers
  ui/               menu, shop, maps, missions, settings, HUD, pause, game over
```
