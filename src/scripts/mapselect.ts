import { BaseModelEntity, Instance } from "cs_script/point_script";

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
    "cs_italy"
];

var configuration = {
    gameHasStarted: false,
    selectedMap: "",
};

Instance.OnScriptInput("SelectMap", (caller) => {

    configuration.selectedMap = caller?.caller?.GetEntityName() ?? "";
    for (var i = 0; i < maps.length; i++) {
        var map = maps[i];
        var mapButton = Instance.FindEntityByName(map);
        if (mapButton instanceof BaseModelEntity) {
            if (mapButton.GetEntityName() != caller?.caller?.GetEntityName()) {
                mapButton.Unglow();
            }
            else {
                mapButton.Glow({ r: 0, g: 255, b: 0 });
                enableStartButton();
            }
        }
    }
});

//Spawn the map when the game starts.
Instance.OnScriptInput("StartGame", (caller) => {
    if(!configuration.gameHasStarted) //Dont spawn multiple maps at the same time.
    {
        Instance.ServerCommand("sv_cheats 1");
        Instance.ServerCommand("spawn_group_load " + configuration.selectedMap);
        configuration.gameHasStarted = true;
        Instance.ServerCommand("sv_cheats 0");
    }
});

const enableStartButton = () => {
    var startButton = Instance.FindEntityByName("start_button");
    if(startButton)
    {
        Instance.EntFireAtTarget({
            target: startButton,
            input: "Enable",
            value: 0,
        });
        var startButtonText = Instance.FindEntityByName("start_button_text");
        if(startButtonText)
        {
            Instance.EntFireAtTarget({
                target: startButtonText,
                input: "setmessage",
                value: "Press E to start",
                delay: 0
            });
        }
    }
}

Instance.OnRoundStart(() => {
    var mapButton = Instance.FindEntityByName(configuration.selectedMap);
    if (mapButton && mapButton instanceof BaseModelEntity) {
        if(configuration.gameHasStarted)//Disable glow when game has started so players cant see the glow when playing.
        {
            mapButton.Glow({ r: 0, g: 255, b: 0 });
        }
        enableStartButton();
    }
});

Instance.OnScriptReload({
    before: () => {
        return { configuration };
    },
    after: (memory) => {
        if (memory && memory.configuration !== undefined) {
            configuration = memory.configuration;
        }
    },
});