import { Instance, type CSPlayerController } from "cs_script/point_script";
import { persistOnReload } from "./persist";
import { findConnectedPlayerControllers } from "./players";
import { CT_TEAM, T_TEAM } from "./teams";

let gameHasStarted = false;

const CONFIGURATION_SPAWN_NAME = "configuration_spawn";
const CT_SPAWN_CLASS = "info_player_counterterrorist";
const T_SPAWN_CLASS = "info_player_terrorist";

// info_player_terrorist/info_player_counterterrorist have no Enable/Disable input, only
// toggleenabled, and every spawn starts enabled by default. Toggling isn't idempotent, so we track
// each group's current enabled state ourselves and only fire the toggle when it actually needs to flip.
let normalSpawnsEnabled = true;
let configurationSpawnsEnabled = true;

let players: CSPlayerController[] = [];

export const getPlayers = (): CSPlayerController[] => players;

// Whether an admin has confirmed mp_shoot_dropped_grenades is enabled server-side, per
// test_mp_shoot_dropped_grenades.ts. The game shouldn't be allowed to start without it.
let mpShootDroppedGrenadesEnabled = false;

export const getMpShootDroppedGrenadesEnabled = (): boolean => mpShootDroppedGrenadesEnabled;

export const setMpShootDroppedGrenadesEnabled = (value: boolean): void => {
    mpShootDroppedGrenadesEnabled = value;
};

// Rescans every player slot. Call this before reading getPlayers() when you need an up to date
// list - this also catches players who connected before this script had loaded.
export const refreshPlayers = (): void => {
    players = findConnectedPlayerControllers();
};

// configuration_spawn entities are themselves info_player_counterterrorist, so they're excluded here
// and toggled separately below.
const setNormalSpawnsEnabled = (enabled: boolean) => {
    if (enabled === normalSpawnsEnabled) return;
    normalSpawnsEnabled = enabled;

    for (const className of [CT_SPAWN_CLASS, T_SPAWN_CLASS]) {
        const spawns = Instance.FindEntitiesByClass(className);
        for (const spawn of spawns) {
            if (spawn.GetEntityName() === CONFIGURATION_SPAWN_NAME) continue;
            Instance.EntFireAtTarget({ target: spawn, input: "toggleenabled" });
        }
    }
};

const setConfigurationSpawnsEnabled = (enabled: boolean) => {
    if (enabled === configurationSpawnsEnabled) return;
    configurationSpawnsEnabled = enabled;

    Instance.EntFireAtName({ name: CONFIGURATION_SPAWN_NAME, input: "toggleenabled" });
};

const forceTPlayersToCt = () => {
    for (const controller of players) {
        if (controller.IsValid() && controller.GetTeamNumber() === T_TEAM) {
            controller.JoinTeam(CT_TEAM);
        }
    }
};

// forceTPlayersToCt() above only runs when applyGameState() is called (e.g. round start) - a player
// who spawns as T in between (say, via a manual jointeam) wouldn't be caught until the next one. This
// catches it immediately on the actual spawn/respawn instead.
Instance.OnPlayerReset((event) => {
    if (gameHasStarted) return;
    if (event.player.GetTeamNumber() !== T_TEAM) return;

    event.player.GetPlayerController()?.JoinTeam(CT_TEAM);
});

// Applies the spawn/team setup for the current gameHasStarted value. Safe to call repeatedly
// (e.g. every round start) to catch late joiners or manual team switches.
export const applyGameState = (): void => {
    setNormalSpawnsEnabled(gameHasStarted);
    setConfigurationSpawnsEnabled(!gameHasStarted);

    if (!gameHasStarted) {
        refreshPlayers();
        forceTPlayersToCt();
    }
};

export const getGameHasStarted = (): boolean => gameHasStarted;

export const setGameHasStarted = (value: boolean): void => {
    gameHasStarted = value;
    applyGameState();
};

persistOnReload("gamestate", {
    gameHasStarted: { get: () => gameHasStarted, set: (value) => { gameHasStarted = value; } },
    normalSpawnsEnabled: { get: () => normalSpawnsEnabled, set: (value) => { normalSpawnsEnabled = value; } },
    configurationSpawnsEnabled: { get: () => configurationSpawnsEnabled, set: (value) => { configurationSpawnsEnabled = value; } },
    players: { get: () => players, set: (value) => { players = value; } },
    mpShootDroppedGrenadesEnabled: { get: () => mpShootDroppedGrenadesEnabled, set: (value) => { mpShootDroppedGrenadesEnabled = value; } },
}, () => {
    // Values are already restored by the time this runs, so this is a no-op unless something is
    // actually out of sync - safe to call, not a resend/inversion of the toggle.
    applyGameState();
});
