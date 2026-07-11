import { Instance } from "cs_script/point_script";
import * as mapselect from "./mapselect";
import * as startgame from "./startgame";
import * as teamconfiguration from "./teamconfiguration";
import * as throwNadesOnDamage from "./throw_nades_on_damage_configuration";
import * as testMpShootDroppedGrenades from "./test_mp_shoot_dropped_grenades";
import * as timers from "../shared/timers";
import { setGameHasStarted } from "../shared/gamestate";

Instance.OnActivate(() => {
    Instance.Msg("Script activated!");
    mapselect.onActivate();
    startgame.onActivate();
    throwNadesOnDamage.onActivate();
    teamconfiguration.onActivate();
});

Instance.OnRoundStart(() => {
    mapselect.onRoundStart();
    startgame.onRoundStart();
    throwNadesOnDamage.onRoundStart();
    teamconfiguration.onRoundStart();
    testMpShootDroppedGrenades.onRoundStart();
});

Instance.OnScriptInput("StartGame", () => {
    setGameHasStarted(true);
    teamconfiguration.onStartGame();
    timers.setTimeout(() => startgame.onStartGame(), 1);
});

Instance.SetThink(() => {
    timers.think();
    throwNadesOnDamage.think();
    Instance.SetNextThink(Instance.GetGameTime());
});
Instance.SetNextThink(Instance.GetGameTime());

