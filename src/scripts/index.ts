import { Instance } from "cs_script/point_script";
import * as mapselect from "./mapselect";
import * as startgame from "./startgame";
import * as teamconfiguration from "./teamconfiguration";
import * as throwNadesOnDamageUi from "./throwNadesOnDamageUi";
import * as welcomeHud from "./welcomeHud";
import * as mainMenu from "./mainMenu";
import * as rockthevote from "./rockthevote";
import * as timers from "../shared/timers";
import { onPlayerReset } from "../shared/gamestate";
import { applyHealthToPlayer } from "./throwNadesOnDamageUi";

// Single shared registration, same pattern as OnActivate/OnRoundStart below - each module that
// needs to react to a player reset gets called from here instead of registering its own.
Instance.OnPlayerReset((event) => {
    onPlayerReset(event);
    applyHealthToPlayer(event.player);
});

// Single shared registration, same reasoning as OnPlayerReset above - only one callback can be
// registered per event name, so each module that needs OnPlayerConnect gets called from here.
Instance.OnPlayerConnect((event) => {
    teamconfiguration.onPlayerConnect(event);
});

// Single shared registration, same reasoning as OnPlayerReset above - only one callback can be
// registered per event name, so each module that needs OnPlayerActivate gets called from here.
Instance.OnPlayerActivate((event) => {
    teamconfiguration.onPlayerActivate(event);
    welcomeHud.onPlayerActivate(event);
    mainMenu.onPlayerActivate(event);
});

// Single shared registration, same reasoning as OnPlayerReset above - only one callback can be
// registered per event name, so each module that needs OnPlayerDisconnect gets called from here.
Instance.OnPlayerDisconnect((event) => {
    teamconfiguration.onPlayerDisconnect(event);
    rockthevote.onPlayerDisconnect(event);
    mainMenu.refreshInputCapture();
});

// Single shared registration, same reasoning as OnPlayerReset above - only one callback can be
// registered per event name, so each module that needs OnPlayerChat gets called from here.
Instance.OnPlayerChat((event) => {
    rockthevote.onPlayerChat(event);
});

// Single shared registration, same reasoning as OnPlayerReset above - only one callback can be
// registered per event name, so each module with a custom_hud_layout gets called from here.
Instance.OnCustomHudClicked((event) => {
    welcomeHud.onCustomHudClicked(event);
    mainMenu.onCustomHudClicked(event);
});

Instance.OnActivate(() => {
    Instance.Msg("Script activated!!!");
    mapselect.onActivate();
    startgame.onActivate();
    teamconfiguration.onActivate();
    mainMenu.onActivate();
});

Instance.OnRoundStart(() => {
    mapselect.onRoundStart();
    startgame.onRoundStart();
    throwNadesOnDamageUi.onRoundStart();
    teamconfiguration.onRoundStart();
    rockthevote.onRoundStart();
    mainMenu.onRoundStart();
});

Instance.SetThink(() => {
    timers.think();
    Instance.SetNextThink(Instance.GetGameTime());
});
Instance.SetNextThink(Instance.GetGameTime());

