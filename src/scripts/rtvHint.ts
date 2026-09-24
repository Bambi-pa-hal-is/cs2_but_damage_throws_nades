import { getMainMenuLayout } from "../shared/hud";
import { getGameHasStarted, isLobbyMap } from "../shared/gamestate";
import * as timers from "../shared/timers";
import { isVoteMode } from "./hostControl";

const RTV_HINT_PANEL_ID = "rtv_hint";
const RTV_HINT_TEXT_ID = "rtv_hint_text";
const ROUND_START_VISIBLE_SECONDS = 8;
const VOTE_UPDATE_VISIBLE_SECONDS = 6;

// Bumped every time the hint is (re)shown, so a stale hide timer from an earlier message can't
// hide a newer one (e.g. a vote update shown while the round-start hint is still up).
let generation = 0;

const setHintHidden = (hidden: boolean): void => {
    const layout = getMainMenuLayout();
    if (!layout) return;
    layout.SetHasClass(RTV_HINT_PANEL_ID, "Hidden", hidden);
};

// Shows `text` in the hint panel for `visibleSeconds`, superseding whatever it was showing before.
const showMessage = (text: string, visibleSeconds: number): void => {
    const layout = getMainMenuLayout();
    if (!layout) return;

    layout.SetDialogVariableString(RTV_HINT_TEXT_ID, "text", text);

    generation++;
    const thisGeneration = generation;
    setHintHidden(false);

    timers.setTimeout(() => {
        if (thisGeneration !== generation) return;
        setHintHidden(true);
    }, visibleSeconds);
};

export const onActivate = (): void => {
    setHintHidden(true);
};

// Shows the "!rtv" hint at the start of every round, but only once the match has actually started
// - during warmup/lobby the main menu is up instead, so there's nothing to hint about yet.
export const onRoundStart = (): void => {
    if (!getGameHasStarted() || !isLobbyMap()) return;
    showMessage(`Type !rtv in chat to ${isVoteMode() ? "vote for" : "let the host pick"} a new map`, ROUND_START_VISIBLE_SECONDS);
};

// Called by rockthevote.ts every time a player votes, so the vote tally shows up on screen and
// not just in chat.
export const showVoteStatus = (votes: number, votesNeeded: number): void => {
    showMessage(`${votes} / ${votesNeeded} votes to ${isVoteMode() ? "vote for" : "let the host pick"} a new map`, VOTE_UPDATE_VISIBLE_SECONDS);
};
