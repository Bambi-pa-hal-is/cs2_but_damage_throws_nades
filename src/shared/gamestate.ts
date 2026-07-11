import { Instance } from "cs_script/point_script";
import { persistOnReload } from "./persist";

let gameHasStarted = false;

const CONFIGURATION_SPAWN_NAME = "configuration_spawn";
const CT_SPAWN_CLASS = "info_player_counterterrorist";
const T_SPAWN_CLASS = "info_player_terrorist";
const CT_TEAM = 3;
const T_TEAM = 2;

// info_player_terrorist/info_player_counterterrorist have no Enable/Disable input, only
// toggleenabled, and every spawn starts enabled by default. Toggling isn't idempotent, so we track
// each group's current enabled state ourselves and only fire the toggle when it actually needs to flip.
let normalSpawnsEnabled = true;
let configurationSpawnsEnabled = true;

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
    const maxSlots = 100;
    for (let slot = 0; slot < maxSlots; slot++) {
        const controller = Instance.GetPlayerController(slot);
        if (controller && controller.IsValid() && controller.GetTeamNumber() === T_TEAM) {
            controller.JoinTeam(CT_TEAM);
        }
    }
};

// Applies the spawn/team setup for the current gameHasStarted value. Safe to call repeatedly
// (e.g. every round start) to catch late joiners or manual team switches.
export const applyGameState = (): void => {
    setNormalSpawnsEnabled(gameHasStarted);
    setConfigurationSpawnsEnabled(!gameHasStarted);

    if (!gameHasStarted) {
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
});
