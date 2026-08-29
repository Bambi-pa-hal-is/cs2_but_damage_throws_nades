import { CSPlayerController, Instance } from "cs_script/point_script";
import { getGameHasStarted } from "../shared/gamestate";
import { printToChat } from "../shared/chat";
import * as mapselect from "./mapselect";
import * as mapReset from "./mapReset";
import * as startgame from "./startgame";
import * as mainMenu from "./mainMenu";

const TRIGGER_PHRASES = new Set(["!rtv", "!rockthevote", "!reset"]);

// Player slots that have voted this match - cleared on round start and once a vote passes.
let votedSlots = new Set<number>();

const countRealPlayers = (): number =>
    Instance.GetAllPlayerControllers().filter((controller) => !controller.IsBot()).length;

const passVote = (): void => {
    Instance.Msg("rockthevote: vote passed - unloading the current map and reopening the menu");
    printToChat("Vote passed - resetting the map.");

    mapReset.unloadMap(mapselect.getSelectedMap());
    startgame.resetMap();
    mainMenu.onActivate();

    votedSlots.clear();
};

// Registered via index.ts's shared Instance.OnPlayerChat dispatch.
export const onPlayerChat = (event: { player?: CSPlayerController, text: string, team: number }): void => {
    // Nothing to reset before a match has actually started - the menu's already up.
    if (!getGameHasStarted()) return;

    const player = event.player;
    if (!player || !player.IsValid() || player.IsBot()) return;

    if (!TRIGGER_PHRASES.has(event.text.trim().toLowerCase())) return;

    const slot = player.GetPlayerSlot();
    if (votedSlots.has(slot)) return;
    votedSlots.add(slot);

    const realPlayerCount = countRealPlayers();
    printToChat(`${player.GetPlayerName()} voted to reset the map (${votedSlots.size}/${realPlayerCount})`);

    if (realPlayerCount > 0 && votedSlots.size > realPlayerCount / 2) {
        passVote();
    }
};

// Registered via index.ts's shared Instance.OnPlayerDisconnect dispatch - a departed player's vote
// shouldn't keep counting toward the (now smaller) real-player total.
export const onPlayerDisconnect = (event: { playerSlot: number }): void => {
    votedSlots.delete(event.playerSlot);
};

export const onRoundStart = (): void => {
    votedSlots.clear();
};
