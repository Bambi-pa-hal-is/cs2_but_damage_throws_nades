// Loads/unloads the chosen map through the lobby's info_spawngroup_load_unload entity instead of
// the spawn_group_load/spawn_group_unload console commands. The entity reports when loading has
// finished (OnSpawnGroupLoadFinished), and ActivateSpawnGroup is what lets bots navigate the map.
// See https://www.source2.wiki/Entities/info_spawngroup_load_unload

import { Instance } from "cs_script/point_script";
import { LOBBY_MAP_NAME } from "../shared/gamestate";

export const SPAWN_GROUP_ENTITY_NAME = "spawngroup_load_unload";

const findSpawnGroupEntity = () => {
    const entity = Instance.FindEntityByName(SPAWN_GROUP_ENTITY_NAME);
    if (!entity) {
        Instance.Msg(`spawnGroup: no entity named ${SPAWN_GROUP_ENTITY_NAME} in the level`);
    }
    return entity;
};

const setSpawnGroup = (mapName: string) => {
    Instance.EntFireAtName({ name: SPAWN_GROUP_ENTITY_NAME, input: "SetSpawnGroup", value: mapName });
};

let loadFinishedConnectionId: number | undefined;

/** Streams mapName in, activates it once it has finished loading, then invokes onActivated. */
export const loadMap = (mapName: string, onActivated: () => void): void => {
    const entity = findSpawnGroupEntity();
    if (!entity) return;

    if (loadFinishedConnectionId !== undefined) {
        Instance.DisconnectOutput(loadFinishedConnectionId);
    }
    loadFinishedConnectionId = Instance.ConnectOutput(entity, "OnSpawnGroupLoadFinished", () => {
        if (loadFinishedConnectionId !== undefined) {
            Instance.DisconnectOutput(loadFinishedConnectionId);
            loadFinishedConnectionId = undefined;
        }
        Instance.Msg(`spawnGroup: ${mapName} finished loading - activating it`);
        setSpawnGroup(mapName);
        Instance.EntFireAtName({ name: SPAWN_GROUP_ENTITY_NAME, input: "ActivateSpawnGroup" });
        onActivated();
    });

    setSpawnGroup(mapName);
    Instance.EntFireAtName({ name: SPAWN_GROUP_ENTITY_NAME, input: "StartSpawnGroupLoad" });
};

/** Streams mapName out. Prune the map's dynamic entities (mapReset.pruneToBaseline) first. */
export const unloadMap = (mapName: string): void => {
    if (!findSpawnGroupEntity()) return;

    // An activated spawn group can't be unloaded - activate the lobby's own spawn group first so
    // mapName is no longer the active one.
    setSpawnGroup(LOBBY_MAP_NAME);
    Instance.EntFireAtName({ name: SPAWN_GROUP_ENTITY_NAME, input: "ActivateSpawnGroup" });

    setSpawnGroup(mapName);
    Instance.EntFireAtName({ name: SPAWN_GROUP_ENTITY_NAME, input: "StartSpawnGroupUnload" });
};
