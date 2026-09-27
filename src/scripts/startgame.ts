import { Instance } from "cs_script/point_script";
import { applyGameState, getGameHasStarted, setGameHasStarted } from "../shared/gamestate";
import { isMenuSkipped } from "./hostControl";

export const onActivate = () => {
    // No lobby phase at all - leave the server's own settings alone and just switch the nade
    // rules on, instead of applying the lobby warmup settings below.
    if (isMenuSkipped()) {
        setGameHasStarted(true);
        return;
    }
    resetMap();
};

// Exported so rockthevote.ts can put the server back into "lobby/warmup" state after unloading a
// map, the same way it's set up on initial activation.
export const resetMap = () => {
    setGameHasStarted(false);
    warmupSettings();
};

export const onStartGame = () => {
    resetWarmupSettings();
};

export const onRoundStart = () => {
    if(!getGameHasStarted())
    {
        warmupSettings();
        applyGameState();
    }
};

const warmupSettings = () => {
    Instance.ServerCommand("mp_autoteambalance 0");
    Instance.ServerCommand("mp_limitteams 0");
    Instance.ServerCommand("mp_warmup_offline_enabled 1");
    Instance.ServerCommand("mp_warmup_pausetimer 1");
    Instance.ServerCommand("mp_autokick 0");
};

const resetWarmupSettings = () => {
    Instance.ServerCommand("mp_warmup_end");
    Instance.ServerCommand("mp_autokick 0");
    Instance.ServerCommand("mp_restartgame 1");
};
