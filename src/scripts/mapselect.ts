import { Instance } from "cs_script/point_script";
import { persistOnReload } from "../shared/persist";
import { getGameHasStarted, CONFIGURATION_SPAWN_NAME } from "../shared/gamestate";
import { getMainMenuLayout } from "../shared/hud";
import * as timers from "../shared/timers";
import * as mapReset from "./mapReset";

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

const highlightMapButton = (selectedMap: string) => {
    const layout = getMainMenuLayout();
    for (let i = 0; i < maps.length; i++) {
        const map = maps[i];
        layout?.SetHasClass(MAP_BUTTON_ID_PREFIX + map, "Selected", map === selectedMap);
    }
};

const highlightSelectedMap = () => {
    highlightMapButton(selectedMap);
};

// Called by mainMenu.ts when the host (playerController[0]) clicks a map card in the HUD.
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

const MAP_SPAWN_GROUP_CLASS = "info_player_counterterrorist";
const MAP_SPAWN_POLL_INTERVAL = 0.1;
const MAP_SPAWN_SETTLE_DELAY = 3;

// spawn_group_load is asynchronous - the map's own info_player_counterterrorist entities only show up once it has actually finished loading.
// Poll the total entity count instead of just the spawn class: as long as new entities keep streaming
// in, the spawn group is still settling. Once the count stops growing for MAP_SPAWN_SETTLE_DELAY
// seconds (and a real info_player_counterterrorist exists), the map is considered loaded.
const waitForMapToLoad = (onLoaded: () => void) => {
    let lastEntityCount = -1;
    let settleTimeRemaining = MAP_SPAWN_SETTLE_DELAY;

    const poll = () => {
        const entityCount = Instance.FindEntitiesByClass("*").length;
        const spawns = Instance.FindEntitiesByClass(MAP_SPAWN_GROUP_CLASS);
        const spawnFound = spawns.some((spawn) => spawn.GetEntityName() !== CONFIGURATION_SPAWN_NAME);

        if (entityCount > lastEntityCount) {
            settleTimeRemaining = MAP_SPAWN_SETTLE_DELAY;
        }
        lastEntityCount = entityCount;

        if (spawnFound && settleTimeRemaining <= 0) {
            onLoaded();
            return;
        }

        settleTimeRemaining -= MAP_SPAWN_POLL_INTERVAL;
        timers.setTimeout(poll, MAP_SPAWN_POLL_INTERVAL);
    };
    poll();
};

// Called once the Start Game button is pressed - loads the chosen map's spawn group into the
// currently running level instead of switching level entirely, then invokes onLoaded once the map
// has actually finished loading.
export const onStartGame = (onLoaded: () => void) => {
    // EXPERIMENTAL - see mapReset.ts. Safe to delete this one line (and the import above) if that
    // approach gets abandoned.
    mapReset.snapshotBaseline();

    Instance.ServerCommand(`sv_cheats 1`);
    Instance.ServerCommand("spawn_group_load " + selectedMap);
    Instance.ServerCommand(`sv_cheats 0`);
    waitForMapToLoad(onLoaded);
};

persistOnReload("mapselect", {
    selectedMap: { get: () => selectedMap, set: (value) => { selectedMap = value; } },
}, () => {
    highlightSelectedMap();
});
