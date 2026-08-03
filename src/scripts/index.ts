import { Instance } from "cs_script/point_script";
import * as mapselect from "./mapselect";
import * as startgame from "./startgame";
import * as teamconfiguration from "./teamconfiguration";
import * as configurationweapon from "./configurationweapon";
import * as throwNadesOnDamageUi from "./throwNadesOnDamageUi";
import * as timers from "../shared/timers";
import { getGameHasStarted, onPlayerReset, setGameHasStarted } from "../shared/gamestate";
import { applyHealthToPlayer } from "./throwNadesOnDamageUi";
import { playSound } from "../shared/sound";

// Single shared registration, same pattern as OnActivate/OnRoundStart below - each module that
// needs to react to a player reset gets called from here instead of registering its own.
Instance.OnPlayerReset((event) => {
    onPlayerReset(event);
    applyHealthToPlayer(event.player);
});

Instance.OnActivate(() => {
    Instance.Msg("Script activated!!!");
    mapselect.onActivate();
    startgame.onActivate();
    teamconfiguration.onActivate();
});

Instance.OnRoundStart(() => {
    mapselect.onRoundStart();
    startgame.onRoundStart();
    throwNadesOnDamageUi.onRoundStart();
    teamconfiguration.onRoundStart();
    configurationweapon.onRoundStart();
});

Instance.OnScriptInput("StartGame", () => {
    if (getGameHasStarted()) return;

    playSound("startgame_success_sound");
    setGameHasStarted(true);
    Instance.EntFireAtName({
        name: "configuration_sky",
        input: "Disable",
    });
    mapselect.onStartGame(() => {
        startgame.onStartGame();
        // startgame.onStartGame() issues mp_restartgame 1, which doesn't actually restart the round
        // until a moment after that - bots get re-evaluated/respawned then, and CS2's bot
        // team-balancing can silently undo a JoinTeam() call made before that point. Assign teams
        // after the restart has actually happened, not before it's even been requested.
        timers.setTimeout(() => teamconfiguration.onStartGame(), 0.1);
    });
});

Instance.SetThink(() => {
    timers.think();
    configurationweapon.think();
    Instance.SetNextThink(Instance.GetGameTime());
});
Instance.SetNextThink(Instance.GetGameTime());

