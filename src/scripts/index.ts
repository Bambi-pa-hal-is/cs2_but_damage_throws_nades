import { Instance } from "cs_script/point_script";
import * as mapselect from "./mapselect";
import * as startgame from "./startgame";
import * as teamconfiguration from "./teamconfiguration";
import * as throwNadesOnDamage from "./throwNadesOnDamage";
import * as throwNadesOnDamageUi from "./throwNadesOnDamageUi";
import * as testMpShootDroppedGrenades from "./testMpShootDroppedGrenades";
import * as timers from "../shared/timers";
import { getMpShootDroppedGrenadesEnabled, setGameHasStarted } from "../shared/gamestate";
import { playSound } from "../shared/sound";
import { printToChat } from "../shared/chat";

Instance.OnActivate(() => {
    Instance.Msg("Script activated!!");
    mapselect.onActivate();
    startgame.onActivate();
    throwNadesOnDamage.onActivate();
    teamconfiguration.onActivate();
});

Instance.OnRoundStart(() => {
    Instance.EntFireAtName({
        name: "configuration_sky",
        input: "Disable",
    });
    mapselect.onRoundStart();
    startgame.onRoundStart();
    throwNadesOnDamageUi.onRoundStart();
    teamconfiguration.onRoundStart();
    testMpShootDroppedGrenades.onRoundStart();
});

Instance.OnScriptInput("StartGame", () => {
    if (!getMpShootDroppedGrenadesEnabled()) {
        playSound("startgame_fail_sound");
        const message = "mp_shoot_dropped_grenades is not enabled - ask an admin to run: mp_shoot_dropped_grenades 1";
        Instance.DebugScreenText({
            text: message,
            x: 25,
            y: 25,
            duration: 15,
        });

        printToChat(message);
        return;
    }

    playSound("startgame_success_sound");
    setGameHasStarted(true);
    teamconfiguration.onStartGame();
    timers.setTimeout(() => startgame.onStartGame(), 1);
});

Instance.SetThink(() => {
    timers.think();
    Instance.SetNextThink(Instance.GetGameTime());
});
Instance.SetNextThink(Instance.GetGameTime());

