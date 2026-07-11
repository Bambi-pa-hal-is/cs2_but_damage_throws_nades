import { BaseModelEntity, Instance } from "cs_script/point_script";
import { persistOnReload } from "../shared/persist";
import { addonId } from "../shared/environment";
import { getGameHasStarted } from "../shared/gamestate";

var maps = [
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

const loadWorkshopMap = () => {
    Instance.DebugScreenText({ text: Instance.GetMapName(), x: 25, y: 25, duration: 60 });
    if (Instance.GetMapName() === "but_damage_throws_nades") {
        Instance.ServerCommand("map_workshop " + addonId + " de_dust2");
    }
};

const highlightMapButton = (selectedMap: string) => {
    for (var i = 0; i < maps.length; i++) {
        var map = maps[i];
        var mapButton = Instance.FindEntityByName(map);
        if (mapButton instanceof BaseModelEntity) {
            if (map != selectedMap) {
                mapButton.Unglow();
            }
            else {
                mapButton.Glow({ r: 0, g: 255, b: 0 });
            }
        }
    }
};

// Maps switch instantly on selection, so the currently loaded map is always the selected one.
const highlightCurrentMap = () => {
    highlightMapButton(Instance.GetMapName());
};

export const onActivate = () => {
    loadWorkshopMap();
    highlightCurrentMap();
};

Instance.OnScriptInput("SelectMap", (caller) => {
    var selectedMap = caller?.caller?.GetEntityName() ?? "";
    Instance.ServerCommand("map_workshop " + addonId + " " + selectedMap);
    highlightMapButton(selectedMap);
});

export const onRoundStart = () => {
    if (getGameHasStarted()) {
        //Disable glow when game has started so players cant see the glow when playing.
        var mapButton = Instance.FindEntityByName(Instance.GetMapName());
        if (mapButton instanceof BaseModelEntity) {
            mapButton.Unglow();
        }
    } else {
        highlightCurrentMap();
    }
};

persistOnReload("mapselect", {}, () => {
    loadWorkshopMap();
    highlightCurrentMap();
});
