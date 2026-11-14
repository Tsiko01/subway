# NOCTURNE — The Night Run

A cinematic 3D endless runner through a moonlit city. React + Vite, Three.js via React Three Fiber, drei, postprocessing, Framer Motion, Tailwind CSS and Lucide icons.

Every asset is generated at runtime, so nothing is downloaded or licensed: the runner character, the textures (asphalt, pavers, water, glow), the building windows (shader), and all music and sound effects (Web Audio synthesis).

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
| Slide (fast-fall when airborne) | ↓ / S | swipe down |
| Pause / resume | Esc / P | pause button |
| Start / retry | Enter | Play button |

## Gameplay

- **Lanes and moves:** three lanes. Jump the low hurdles and jersey barriers, slide under the gantries, and dodge the walls, the oncoming cars and the rolling chrome spheres.
- **Pacing:** speed rises from 16 to 40 m/s, and obstacle patterns get denser and harder with distance. A pattern generator guarantees every row has a reachable open lane.
- **Scoring:** 1 point per meter plus 25 per azure drop, all multiplied. Every 25 drops raises the multiplier (up to ×6). The *Double* power-up doubles it, and *Magnet* pulls drops to you.
- **Best score:** saved in `localStorage`.
- **Zones:** the city changes every 900 m: Midnight Avenue → Harbor Bridge → Glass District, with smooth fog and light transitions.

## Graphics tiers

The tier toggle is in the menu and the pause screen. The starting tier is detected from the device. If the frame rate stays under ~40 fps, the game steps down a tier automatically, unless the player picked one by hand.

- **Cinematic:** wet-road reflections, 2048 px shadows, HDR bloom with MSAA, film grain.
- **Balanced:** HDR bloom, 1024 px shadows, no reflector.
- **Performance:** no post-processing composer, renderer tone mapping only, capped pixel ratio. Used by default on phones.

## Structure

```
src/
  game/      constants, zustand store (UI state), runtime (per-frame state), audio synth,
             input (keys + swipes), procedural textures, zone atmosphere blending
  scene/     Director (clock, speed, score), World (road, water, sky, lights), Scenery
             (instanced, recycled city segments), Player (procedural runner + animation),
             Spawner + Obstacles (pooled obstacles, drops, power-ups, collisions),
             CameraRig, Effects3D (particles, motes, speed lines), PostFX
  ui/        Intro, MainMenu, HUD, PauseMenu, GameOver, Toasts, Buttons
```

The render loop never touches React state. Simulation values live in a mutable `runtime` object. The HUD reads them in its own `requestAnimationFrame` loop and writes straight to the DOM. Obstacles, drops and scenery are pooled and reused, so nothing is allocated during play.
