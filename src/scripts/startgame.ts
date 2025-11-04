import { Instance } from "cs_script/point_script";

var configuration = {
    gameHasStarted: false,
};

Instance.OnActivate(() => {
    configuration.gameHasStarted = false;
    warmupSettings();
});

Instance.OnScriptInput("StartGame", (_) => {
    configuration.gameHasStarted = true;
    disableSpawns();
    resetWarmupSettings();
});

Instance.OnRoundStart(() => {
    if(!configuration.gameHasStarted)
    {
        warmupSettings();
    }
});

const warmupSettings = () => {
    Instance.ServerCommand("sv_cheats 1");
    Instance.ServerCommand("mp_autoteambalance 0");
    Instance.ServerCommand("mp_limitteams 0");
    Instance.ServerCommand("sv_infinite_ammo 1");
    Instance.ServerCommand("weapon_accuracy_nospread 1");
    Instance.ServerCommand("mp_warmup_offline_enabled 1");
    Instance.ServerCommand("mp_warmup_pausetimer 1");
    Instance.ServerCommand("sv_autobunnyhopping 1");
    Instance.ServerCommand("sv_enablebunnyhopping 1");
    Instance.ServerCommand("mp_autokick 0");
    if(!Instance.IsWarmupPeriod()) {
        Instance.ServerCommand("mp_warmup_start");
    }
};

const resetWarmupSettings = () => {
    Instance.ServerCommand("sv_cheats 1");
    Instance.ServerCommand("sv_infinite_ammo 0");
    Instance.ServerCommand("weapon_accuracy_nospread 0");
    Instance.ServerCommand("mp_warmup_end");
    Instance.ServerCommand("sv_autobunnyhopping 0");
    Instance.ServerCommand("sv_enablebunnyhopping 0");
    Instance.ServerCommand("mp_autokick 0");
    Instance.ServerCommand("sv_cheats 0");
};

const disableSpawns = () => {
    // Instance.ServerCommand("sv_cheats 1");
    // Instance.ServerCommand("ent_fire configuration_spawn toggleenabled");
    // Instance.ServerCommand("sv_cheats 0");
    Instance.EntFireAtName({name: "configuration_spawn", input: "toggleenabled"});
}

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