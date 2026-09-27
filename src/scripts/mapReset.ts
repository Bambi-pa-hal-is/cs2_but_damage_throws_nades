// EXPERIMENTAL - unloading a spawn group only fully removes a loaded map without crashing
// PROVIDED the dynamic entities it spawned (props, dropped weapons, etc.) are cleared out first.
// This file snapshots every entity that exists right before loading a map, then later diffs a fresh
// snapshot against it, removes whatever's new, and only then unloads the spawn group (spawnGroup.ts).
//
// Kept fully separate from the rest of the game flow on purpose - if this doesn't pan out, delete
// this file and the one call to snapshotBaseline() in mapselect.ts (grep for "mapReset") and
// everything's back to how it was.
//
// point_script.d.ts exposes no unique id/handle on Entity, and JS object identity isn't enough
// either: the round restart after a map load (mp_warmup_end/mp_restartgame) deletes and respawns
// the lobby's own entities, so they come back as new objects that were never in the snapshot. The
// baseline therefore stores a class + name + spawn position key per entity - a respawned lobby
// entity gets the same key back, while the loaded map's entities never had one. The weak spot is a
// lobby entity that has moved away from its spawn position by the time of the prune.

import { CSObserverPawn, CSPlayerController, CSPlayerPawn, CustomPlayerCamera, Entity, Instance } from "cs_script/point_script";
import { setTimeout } from "../shared/timers";
import { persistOnReload } from "../shared/persist";
import { disableMinimap, MINIMAP_VOLUME_PREFIX } from "./minimap";
import * as spawnGroup from "./spawnGroup";

let baseline: Set<string> | undefined;

const entityKey = (entity: Entity): string => {
    const { x, y, z } = entity.GetAbsOrigin();
    return `${entity.GetClassName()}|${entity.GetEntityName()}|${Math.round(x)},${Math.round(y)},${Math.round(z)}`;
};

// Never removed, regardless of baseline membership - a player who connects after
// snapshotBaseline() is "new" as far as the diff is concerned, but is obviously not part of the
// loaded map's spawn group and must never be touched here. The spawn group entity is needed right
// after the prune to unload the map, and the lobby's minimap volumes are reused for every map, so
// neither is ever removed.
const isProtected = (entity: Entity): boolean =>
    entity.GetEntityName() === spawnGroup.SPAWN_GROUP_ENTITY_NAME
    || entity.GetEntityName().startsWith(MINIMAP_VOLUME_PREFIX)
    || entity instanceof CSPlayerController
    || entity instanceof CSPlayerPawn
    || entity instanceof CSObserverPawn
    || entity instanceof CustomPlayerCamera;

/**
 * Snapshots every entity that currently exists. Call this right before the first map load.
 * The baseline is permanent once set - it never changes, so this refuses to overwrite an existing
 * non-empty one. pruneToBaseline() can be called as many times as needed (e.g. once per map
 * swap) and always diffs against this same original snapshot.
 */
export const snapshotBaseline = (): void => {
    if (baseline && baseline.size > 0) {
        Instance.Msg(`mapReset: snapshotBaseline() ignored - a baseline of ${baseline.size} entities already exists and never changes`);
        return;
    }

    baseline = new Set(Instance.FindEntitiesByClass("*").map(entityKey));
    Instance.Msg(`mapReset: snapshotted ${baseline.size} entities as baseline`);
};

/**
 * Removes every entity that exists now but wasn't present in the baseline - in theory, everything
 * every subsequently-loaded map's spawn group has brought in. Never touches player
 * controllers/pawns/cameras. Does nothing (and logs a warning) if snapshotBaseline() was never
 * called. The baseline itself is left untouched, so this is safe to call again later.
 */
export const pruneToBaseline = (): void => {
    if (!baseline) {
        Instance.Msg("mapReset: pruneToBaseline() called with no baseline - call snapshotBaseline() first");
        return;
    }

    const current = Instance.FindEntitiesByClass("*");
    let kept = 0;
    let protectedCount = 0;
    let removed = 0;

    for (const entity of current) {
        if (!entity.IsValid()) continue;
        if (baseline.has(entityKey(entity))) {
            kept++;
            continue;
        }
        if (isProtected(entity)) {
            protectedCount++;
            continue;
        }

        entity.Remove();
        removed++;
    }

    Instance.Msg(`mapReset: kept ${kept} baseline entities, skipped ${protectedCount} protected (player/pawn/camera), removed ${removed} others`);
};

// Survives a Tools-mode script reload - without this, editing any script file mid-test would wipe
// the in-progress baseline Set, same pattern as teamconfiguration.ts persisting its player list.
persistOnReload("mapReset", {
    baseline: { get: () => baseline, set: (value) => { baseline = value; } },
});

/** Prunes to baseline, then unloads the map through the spawn group entity - the full "unload" sequence. */
export const unloadMap = (mapName: string): void => {
    // The minimap volumes live in the lobby level (so they're part of the baseline and survive the
    // prune) - switch this map's off so it doesn't linger over the next map loaded in the same spot.
    disableMinimap(mapName);
    pruneToBaseline();
    // setTimeout's delay is in seconds (game time), not ms - this is 0.5s, giving Remove()'d
    // entities a moment to actually get cleaned up before the spawn group is unloaded.
    setTimeout(() => {
        spawnGroup.unloadMap(mapName);
        Instance.Msg(`mapReset: started unloading spawn group ${mapName}`);
    }, 0.5);
};

// Debug hooks so this can be tested from Hammer I/O without wiring it into the real
// start-game/reset flow yet (e.g. `ent_fire point_script_entity_name RunScriptInput
// mapReset_pruneToBaseline`), plus matching console commands (need sv_cheats 1, which warmup
// already sets) for quicker testing.
Instance.OnScriptInput("mapReset_snapshotBaseline", snapshotBaseline);
Instance.OnScriptInput("mapReset_pruneToBaseline", pruneToBaseline);

Instance.RegisterCheatCommand("mapreset_snapshot", snapshotBaseline);
Instance.RegisterCheatCommand("mapreset_prune", pruneToBaseline);
// Usage: mapreset_check - dry run of pruneToBaseline(): lists the named entities it would remove
// without removing anything.
Instance.RegisterCheatCommand("mapreset_check", () => {
    if (!baseline) {
        Instance.Msg("mapreset_check: no baseline yet");
        return;
    }
    const current = Instance.FindEntitiesByClass("*");
    const wouldRemove = current.filter((entity) => !baseline!.has(entityKey(entity)) && !isProtected(entity));
    Instance.Msg(`mapreset_check: baseline=${baseline.size} current=${current.length} wouldRemove=${wouldRemove.length}`);
    for (const entity of wouldRemove.filter((entity) => entity.GetEntityName() !== "")) {
        Instance.Msg(`  ${entityKey(entity)}`);
    }
});

// Usage: mapreset_unload de_dust2 - runs pruneToBaseline() then unloads the de_dust2 spawn group.
Instance.RegisterCheatCommand("mapreset_unload", (args) => {
    const mapName = args.trim();
    if (!mapName) {
        Instance.Msg("mapreset_unload: usage: mapreset_unload <map_name>");
        return;
    }
    unloadMap(mapName);
});
