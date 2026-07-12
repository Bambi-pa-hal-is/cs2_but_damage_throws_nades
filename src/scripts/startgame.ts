import { Instance } from "cs_script/point_script";
import { applyGameState, getGameHasStarted, setGameHasStarted } from "../shared/gamestate";
import { printToChat } from "../shared/chat";

export const onActivate = () => {
    resetMap();
};

const RESET_CHAT_COMMAND = ".reset";

const resetMap = () => {
    setGameHasStarted(false);
    warmupSettings();
};

Instance.OnPlayerChat((event) => {
    if (event.text.trim() != RESET_CHAT_COMMAND) return;

    resetMap();
    Instance.ServerCommand("mp_restartgame 1");
});

export const onStartGame = () => {
    resetWarmupSettings();
};

export const onRoundStart = () => {
    if(!getGameHasStarted())
    {
        warmupSettings();
        applyGameState();
        printToChat(`Type ${RESET_CHAT_COMMAND} to reset the game and switch map or change the rules.`);
    }
};

const warmupSettings = () => {
    Instance.ServerCommand("sv_cheats 1");
    Instance.ServerCommand("mp_shoot_dropped_grenades 1");
    Instance.ServerCommand("mp_autoteambalance 0");
    Instance.ServerCommand("mp_limitteams 0");
    Instance.ServerCommand("sv_infinite_ammo 1");
    Instance.ServerCommand("weapon_accuracy_nospread 1");
    Instance.ServerCommand("mp_warmup_offline_enabled 1");
    Instance.ServerCommand("mp_warmup_pausetimer 1");
    Instance.ServerCommand("sv_autobunnyhopping 1");
    Instance.ServerCommand("sv_enablebunnyhopping 1");
    Instance.ServerCommand("mp_autokick 0");
    Instance.ServerCommand("mp_solid_enemies 0");
    Instance.ServerCommand("mp_solid_teammates 0");
    if(!Instance.IsWarmupPeriod()) { //we need to check if it already is warmup or an infinite loop will occur
        Instance.ServerCommand("mp_warmup_start 1");
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
    Instance.ServerCommand("mp_solid_enemies 1");
    Instance.ServerCommand("mp_solid_teammates 1");
    Instance.ServerCommand("mp_restartgame 1");
    Instance.ServerCommand("sv_cheats 0");
};
