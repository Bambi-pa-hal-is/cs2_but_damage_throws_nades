import { Instance } from "cs_script/point_script";
import { getGameHasStarted, setGameHasStarted } from "../shared/gamestate";
import * as mapselect from "./mapselect";
import * as startgame from "./startgame";
import * as teamconfiguration from "./teamconfiguration";
import * as timers from "../shared/timers";
import { playSound } from "../shared/sound";

// Extracted out of index.ts's StartGame handler so both the legacy world "start_button" and the
// new HUD start button can trigger the exact same flow. `onStarted` fires once the chosen map has
// actually finished loading and teams have been assigned - the HUD uses it to hide the spinner.
export const beginGame = (onStarted: () => void): void => {
    if (getGameHasStarted()) return;

    playSound("startgame_success_sound");
    setGameHasStarted(true);
    Instance.EntFireAtName({
        name: "configuration_sky",
        input: "Disable",
    });
    mapselect.onStartGame(() => {
        teamconfiguration.onStartGame();
        // Give the JoinTeam() calls a moment to actually take effect before startgame.onStartGame()
        // issues mp_restartgame 1 (which is what actually moves players to their new team's spawns).
        timers.setTimeout(() => {
            startgame.onStartGame();
            onStarted();
        }, 1);
    });
};
