import { Instance } from "cs_script/point_script";
import { getGameHasStarted, isLobbyMap, setGameHasStarted } from "../shared/gamestate";
import * as mapselect from "./mapselect";
import * as minimap from "./minimap";
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
    const onMapReady = () => {
        teamconfiguration.onStartGame();
        // Give the JoinTeam() calls a moment to actually take effect before startgame.onStartGame()
        // issues mp_restartgame 1 (which is what actually moves players to their new team's spawns).
        timers.setTimeout(() => {
            startgame.onStartGame();
            // mp_restartgame's own round-restart handling can re-evaluate bot teams on its own
            // (independent of mp_autoteambalance, which only governs rebalancing already-teamed
            // players), sometimes silently pulling a bot back onto a different team than the one
            // JoinTeam() just put it on above. Re-apply the intended teams once the restart has
            // had a moment to settle so any bot drift gets corrected back.
            timers.setTimeout(() => {
                teamconfiguration.onStartGame();
            }, 0.5);
            onStarted();
        }, 1);
    };

    // On a real map (not the lobby) the map is already loaded and has its own radar.
    if (!isLobbyMap()) {
        onMapReady();
        return;
    }
    mapselect.onStartGame(() => {
        minimap.enableMinimap(mapselect.getSelectedMap());
        onMapReady();
    });
};
