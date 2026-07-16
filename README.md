# CS2 But Damage Throws Nades

A CS2 workshop addon/gamemode: every time you deal damage (and optionally, every time you shoot), you automatically throw a random grenade from your eye position. Built as a TypeScript `cs_script` point_script addon.

[Workshop map](https://steamcommunity.com/sharedfiles/filedetails/?id=3595406215)

Created by [Bambi-pa-hal-is](https://steamcommunity.com/id/Bambi_pa_hal_is/). Thanks to Girlglock.

---

## How it plays

The addon boots into a lobby map (`but_damage_throws_nades`) where players:

1. Select the competitive map to play, from the official competitive map pool.
2. Switch teams (CT/T) by shooting their own name, shown on an in-world button per player.
3. Configure the nade-throwing rules through an in-world UI: which grenade types are allowed (HE, flashbang, smoke, molotov, decoy), whether shooting *and/or* dealing damage triggers a throw, the trigger chance for each, and whether only your currently-equipped nades can be picked.
4. Press **Start Game** to load the chosen map and begin a competitive-ruleset match with those settings active.

From then on, `OnModifyPlayerDamage` (and optionally `OnGunFire`) rolls the dice and launches a real, physics-simulated grenade of a random allowed type from the triggering player.

## Project layout

```
src/scripts/          Point-script entry points, one per feature
  index.ts               Wires up Instance.OnActivate / OnRoundStart / think loop
  mapselect.ts           Lobby map voting + loading the chosen map
  teamconfiguration.ts   Lobby team-pick buttons + assigning teams on start
  startgame.ts           Warmup/competitive server settings, start/reset flow
  throwNadesOnDamage.ts  Core mechanic: spawning, physics correction, detonation workaround
  throwNadesOnDamageUi.ts  In-world config UI (checkboxes, chance sliders)
src/shared/            Helpers shared across scripts (persistence, gamestate, teams, timers, vectors, sound, chat, UI, spawning)
cfg/maps/              Per-map server cfg (e.g. exec gamemode_competitive)
maps/                  .vmap files + shared loading screen text
scripts/               Build output (bundled JS actually loaded by the game) - generated, gitignored
```

### Notable implementation details

- **Grenades no longer self-detonate when spawned via script** (a Valve engine change), so real projectiles are spawned for flight/physics, and a separate pickup "action" template is force-damaged to trigger the actual explosion once a per-type condition is met (fixed delay for HE/molotov, "stopped moving" for smoke/decoy). See `throwNadesOnDamage.ts` for the full workaround.
- **Hot-reload state persistence** (`src/shared/persist.ts`): tools-mode script reloads clear all module state, so each feature module registers its live state to be snapshotted/restored across a reload via `Instance.OnScriptReload`.

## Known issues

- **Grenade physics are bugged and manually corrected.** Scripted grenade replicas fall at generic prop gravity instead of real grenade gravity, so each tracked nade's fall acceleration is measured every tick and corrected toward the real ~320 u/s² value. This is a workaround to make the thrown nades replicate more familiar/expected grenade behavior, not a perfect match for how real grenades fly.
- **Decoy grenades don't make sound.**
- **Detonations are faked.** Because HE/smoke/molotov/decoy no longer self-detonate when spawned via script, their "explosion" is actually triggered by force-damaging a separate pickup entity at the projectile's resting position rather than the grenade genuinely detonating. **Flashbangs are the only type that behave exactly as expected**, since they still self-detonate normally.
- **Incendiary projectile can't be spawned.** The incendiary grenade's own projectile is bugged, so the molotov family always launches using the molotov projectile regardless of which one the player is actually carrying. This means that with "only randomize between currently-equipped grenades" enabled, a player carrying an incendiary will see a molotov-looking projectile in flight, but the grenade that ends up detonating (and the resulting fire) is correctly an incendiary.
- **No minimap or bot support.** Because the selected map is loaded as a spawn group into the running lobby level rather than a real level transition, the minimap and bots are sadly not supported.

## Setup

1. Install Node.js.
2. Clone this repository into `content/csgo_addons/` inside your CS2 install (this addon expects to live at `.../content/csgo_addons/cs2_but_damage_throws_nades`, since the build scripts locate the game root by walking up from the current directory looking for a `content` folder).
3. Install dependencies:
   ```
   npm i
   ```
4. Start the watch build:
   ```
   npm run dev
   ```
5. With `npm run dev` running, start/build the map in-game. The addon won't be running the current code yet at this point - make an actual code change in `src/` (a real edit, not just an added blank line, since esbuild's watcher needs a real content change to trigger a rebuild) and save. This kicks off a rebuild and script reload, after which the script is live.

## Scripts

- `npm run dev` / `npm run watch` — esbuild in watch mode; bundles `src/scripts/index.ts` to `scripts/index.js` and copies `cfg/maps/*.cfg` to the game's addon cfg folder on every build.
- `npm run build` — one-shot typecheck + build.
- `npm run typecheck` / `npm run typecheck:watch` — TypeScript checking only, no output.
- `npm run copy-cfgs` — copy `cfg/maps/*.cfg` into the running game's addon folder without a full build.
- `npm run copy-loadingscreen` — stamp the shared loading screen text out to each map listed in `mapselect.ts`.
- `npm run update-types` — refresh `src/scripts/point_script.d.ts` from the game's own copy (`csgo/maps/editor/zoo/scripts/point_script.d.ts`), useful after a CS2 update changes the API.

In-game, load the addon's map through the CS2 tools/Hammer workflow and use the in-editor "Start" tooling to run the point_script.
