import { Instance } from "cs_script/point_script";
import { persistOnReload } from "../shared/persist";
import { getGameHasStarted, CONFIGURATION_SPAWN_NAME } from "../shared/gamestate";
import { getMainMenuLayout } from "../shared/hud";
import * as timers from "../shared/timers";
import * as mapReset from "./mapReset";
import * as spawnGroup from "./spawnGroup";
import { isVoteMode } from "./hostControl";

const maps = [
    "de_overpass",
    "de_dust2",
    "de_nuke",
    "de_mirage",
    "de_inferno",
    "de_train",
    "de_vertigo",
    "de_ancient",
    "de_ancient_night",
    "de_anubis",
    "cs_office",
    "cs_italy",
    "de_cache"
];

const MAP_BUTTON_ID_PREFIX = "map_";

let selectedMap = maps[Math.floor(Math.random() * maps.length)];

export const getSelectedMap = (): string => selectedMap;

export const getMaps = (): readonly string[] => maps;

const highlightMapButton = (selectedMap: string) => {
    const layout = getMainMenuLayout();
    for (let i = 0; i < maps.length; i++) {
        const map = maps[i];
        // In vote mode there's no single selection to show - mapvote.ts highlights each player's
        // own vote instead.
        layout?.SetHasClass(MAP_BUTTON_ID_PREFIX + map, "Selected", !isVoteMode() && map === selectedMap);
    }
};

const highlightSelectedMap = () => {
    highlightMapButton(selectedMap);
};

// Called by mainMenu.ts when the host clicks a map card in the HUD, or once a map vote finishes.
export const selectMap = (mapName: string): void => {
    if (!maps.includes(mapName) || mapName === selectedMap) return;
    selectedMap = mapName;
    highlightMapButton(selectedMap);
};

export const renderHud = (): void => {
    highlightSelectedMap();
};

export const onActivate = () => {
    highlightSelectedMap();
};

export const onRoundStart = () => {
    if (!getGameHasStarted()) {
        highlightSelectedMap();
    }
};

const MAP_SPAWN_CLASS = "info_player_counterterrorist";
const MAP_SPAWN_POLL_INTERVAL = 0.1;

// ActivateSpawnGroup is a queued input, so the map's own info_player_counterterrorist entities
// only show up a moment after it's fired - wait for one before handing over to the game.
const waitForMapSpawns = (onReady: () => void) => {
    const poll = () => {
        const spawns = Instance.FindEntitiesByClass(MAP_SPAWN_CLASS);
        if (spawns.some((spawn) => spawn.GetEntityName() !== CONFIGURATION_SPAWN_NAME)) {
            onReady();
            return;
        }
        timers.setTimeout(poll, MAP_SPAWN_POLL_INTERVAL);
    };
    poll();
};

// Called once the Start Game button is pressed - loads the chosen map's spawn group into the
// currently running level instead of switching level entirely, then invokes onLoaded once the map
// has finished loading and been activated.
export const onStartGame = (onLoaded: () => void) => {
    // EXPERIMENTAL - see mapReset.ts. Safe to delete this one line (and the import above) if that
    // approach gets abandoned.
    mapReset.snapshotBaseline();

    spawnGroup.loadMap(selectedMap, () => waitForMapSpawns(onLoaded));
};

persistOnReload("mapselect", {
    selectedMap: { get: () => selectedMap, set: (value) => { selectedMap = value; } },
}, () => {
    highlightSelectedMap();
});
