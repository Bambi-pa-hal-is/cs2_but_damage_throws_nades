import { BaseModelEntity, Instance } from "cs_script/point_script";
import { persistOnReload } from "../shared/persist";
import { getGameHasStarted, CONFIGURATION_SPAWN_NAME } from "../shared/gamestate";
import { getMainMenuLayout } from "../shared/hud";
import * as timers from "../shared/timers";

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

// Paints both the legacy in-world glow AND the new HUD's "Selected" card highlight, so either UI
// stays correct no matter which one (or which script reload path) drove the change.
const highlightMapButton = (selectedMap: string) => {
    const layout = getMainMenuLayout();
    for (let i = 0; i < maps.length; i++) {
        const map = maps[i];
        const mapButton = Instance.FindEntityByName(map);
        if (mapButton instanceof BaseModelEntity) {
            if (map != selectedMap) {
                mapButton.Unglow();
            }
            else {
                mapButton.Glow({ r: 0, g: 255, b: 0 });
            }
        }
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

// Kept for the legacy in-world map buttons - RunScriptInput passes the button itself as `caller`,
// whose entity name is the map name.
Instance.OnScriptInput("SelectMap", (caller) => {
    const mapName = caller?.caller?.GetEntityName();
    if (mapName) {
        selectMap(mapName);
    }
});

export const onRoundStart = () => {
    if (getGameHasStarted()) {
        //Disable glow when game has started so players cant see the glow when playing.
        const mapButton = Instance.FindEntityByName(selectedMap);
        if (mapButton instanceof BaseModelEntity) {
            mapButton.Unglow();
        }
    } else {
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

        // DEBUG: remove this DebugScreenText call once loading behaves as expected.
        Instance.DebugScreenText({
            text: `waitForMapToLoad: entities=${entityCount} spawnFound=${spawnFound} settle=${settleTimeRemaining.toFixed(1)}s`,
            x: 25, y: 25, duration: MAP_SPAWN_POLL_INTERVAL * 2, color: { r: 255, g: 255, b: 0 }
        });

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
    Instance.ServerCommand("spawn_group_load " + selectedMap);
    waitForMapToLoad(onLoaded);
};

persistOnReload("mapselect", {
    selectedMap: { get: () => selectedMap, set: (value) => { selectedMap = value; } },
}, () => {
    highlightSelectedMap();
});
