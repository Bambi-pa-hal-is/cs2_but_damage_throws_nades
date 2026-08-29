// EXPERIMENTAL - spawn_group_load has no counterpart to unload what it loaded on its own, but
// `spawn_group_unload <mapname>` turns out to fully remove a loaded map without crashing, PROVIDED
// the dynamic entities it spawned (props, dropped weapons, etc.) are cleared out first. This file
// snapshots every entity that exists right before loading a map, then later diffs a fresh snapshot
// against it, removes whatever's new, and only then issues spawn_group_unload.
//
// Kept fully separate from the rest of the game flow on purpose - if this doesn't pan out, delete
// this file and the one call to snapshotBaseline() in mapselect.ts (grep for "mapReset") and
// everything's back to how it was.
//
// The load-bearing assumption this whole approach rests on: point_script.d.ts exposes no unique
// id/handle on Entity, so "is this the same entity as before" is done here via JS object identity
// (Set membership) across two separate Instance.FindEntitiesByClass("*") calls. That only works if
// the native binding hands back the same JS wrapper object for the same underlying entity every
// time it's queried. If it instead constructs a fresh wrapper per call, the baseline set and the
// "current" set would never intersect - pruneToBaseline() would then try to remove every entity in
// the game, baseline ones included. Sanity-check the "kept N / removed M" Msg output on a small
// scale before ever wiring this into a real reset flow.

import { CSObserverPawn, CSPlayerCamera, CSPlayerController, CSPlayerPawn, Entity, Instance } from "cs_script/point_script";
import { setTimeout } from "../shared/timers";
import { persistOnReload } from "../shared/persist";

let baseline: Set<Entity> | undefined;

// Never removed, regardless of baseline membership - a player who connects after
// snapshotBaseline() is "new" as far as the diff is concerned, but is obviously not part of the
// loaded map's spawn group and must never be touched here.
const isProtected = (entity: Entity): boolean =>
    entity instanceof CSPlayerController
    || entity instanceof CSPlayerPawn
    || entity instanceof CSObserverPawn
    || entity instanceof CSPlayerCamera;

/**
 * Snapshots every entity that currently exists. Call this right before the first spawn_group_load.
 * The baseline is permanent once set - it never changes, so this refuses to overwrite an existing
 * non-empty one. pruneToBaseline() can be called as many times as needed (e.g. once per map
 * swap) and always diffs against this same original snapshot.
 */
export const snapshotBaseline = (): void => {
    if (baseline && baseline.size > 0) {
        Instance.Msg(`mapReset: snapshotBaseline() ignored - a baseline of ${baseline.size} entities already exists and never changes`);
        return;
    }

    baseline = new Set(Instance.FindEntitiesByClass("*"));
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
        if (baseline.has(entity)) {
            kept++;
            continue;
        }
        if (isProtected(entity)) {
            protectedCount++;
            continue;
        }
        if (!entity.IsValid()) continue;

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

/** Prunes to baseline, then issues spawn_group_unload for the given map - the full "unload" sequence. */
export const unloadMap = (mapName: string): void => {
    pruneToBaseline();
    // setTimeout's delay is in seconds (game time), not ms - this is 0.5s, giving Remove()'d
    // entities a moment to actually get cleaned up before spawn_group_unload runs.
    setTimeout(() => {
        Instance.ServerCommand(`sv_cheats 1`);
        Instance.ServerCommand(`spawn_group_unload ${mapName}`);
        Instance.ServerCommand(`sv_cheats 0`);
        Instance.Msg(`mapReset: issued spawn_group_unload for ${mapName}`);
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
// Usage: mapreset_unload de_dust2 - runs pruneToBaseline() then spawn_group_unload de_dust2.
Instance.RegisterCheatCommand("mapreset_unload", (args) => {
    const mapName = args.trim();
    if (!mapName) {
        Instance.Msg("mapreset_unload: usage: mapreset_unload <map_name>");
        return;
    }
    unloadMap(mapName);
});
