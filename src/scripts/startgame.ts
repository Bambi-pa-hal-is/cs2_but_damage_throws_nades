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
    Instance.ServerCommand("mp_freezetime 0");
    Instance.ServerCommand("mp_limitteams 0");
    Instance.ServerCommand("sv_infinite_ammo 1");
    Instance.ServerCommand("weapon_accuracy_nospread 1");
    Instance.ServerCommand("mp_roundtime 60");
    Instance.ServerCommand("mp_roundtime_defuse 60");
    Instance.ServerCommand("mp_roundtime_hostage 60");
    Instance.ServerCommand("mp_friendlyfire 0");
    Instance.ServerCommand("sv_cheats 0");
};

const resetWarmupSettings = () => {
    Instance.ServerCommand("sv_cheats 1");
    Instance.ServerCommand("sv_infinite_ammo 0");
    Instance.ServerCommand("weapon_accuracy_nospread 0");
    Instance.ServerCommand("mp_roundtime 1.92");
    Instance.ServerCommand("mp_roundtime_defuse 1.92");
    Instance.ServerCommand("mp_roundtime_hostage 1.92");
    Instance.ServerCommand("mp_restartgame 1");
    Instance.ServerCommand("mp_freezetime 15");
    Instance.ServerCommand("mp_friendlyfire 1");
    Instance.ServerCommand("mp_warmup_end");
    Instance.ServerCommand("sv_cheats 0");
};

const disableSpawns = () => {
    if(!configuration.gameHasStarted)
    {
        return;
    }
    Instance.ServerCommand("sv_cheats 1");
    Instance.ServerCommand("ent_fire configuration_spawn toggleenabled");
    Instance.ServerCommand("sv_cheats 0");
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