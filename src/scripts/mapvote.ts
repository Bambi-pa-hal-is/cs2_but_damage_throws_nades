import { CSPlayerController, Instance } from "cs_script/point_script";
import { persistOnReload } from "../shared/persist";
import { getMainMenuLayout } from "../shared/hud";
import { getGameHasStarted } from "../shared/gamestate";
import { printToChat } from "../shared/chat";
import { playSoundForPlayer } from "../shared/sound";
import * as timers from "../shared/timers";
import * as mapselect from "./mapselect";
import { isVoteMode } from "./hostControl";

// How long players get to vote (and change their vote), counted from the first vote cast. Once it
// runs out, the map with the most votes is started.
export const MAP_VOTE_DURATION_SECONDS = 20;

const START_BUTTON_ID = "start_game_button";
const MAP_BUTTON_PREFIX = "map_";
const TICK_INTERVAL_SECONDS = 0.2;
// Played only for the voting player, as feedback that their click registered.
const CLICK_SOUND_NAME = "click_sound";

// TEMPORARY testing aid - every real vote also adds this many fake voters for the same map, so the
// UI can be checked with several people voting. Set to 0 to turn it off.
const DEBUG_FAKE_VOTES_PER_VOTE = 0;

// Player slot -> voted map. A plain object rather than a Map so it survives persistOnReload.
let votes: Record<number, string> = {};
// Game time the vote ends at, or undefined while nobody has voted yet.
let voteEndsAt: number | undefined;
// Same superseding trick as mainMenu.ts's countdownGeneration - a stale tick chain stops itself.
let tickGeneration = 0;
let lastRenderedSecondsLeft: number | undefined;
// Fake voter slot -> name. Fake slots are negative so they never collide with a real player slot.
let fakeVoterNames: Record<number, string> = {};

let onVoteFinished: (winningMap: string) => void = () => {};

// mainMenu.ts hands in its start flow here instead of this module importing mainMenu.ts back.
export const setOnVoteFinished = (callback: (winningMap: string) => void): void => {
    onVoteFinished = callback;
};

// "de_ancient_night" -> "Ancient Night"
const formatMapName = (map: string): string =>
    map.replace(/^(de|cs)_/, "").split("_").map((word) => word.charAt(0).toUpperCase() + word.substring(1)).join(" ");

const formatCountdown = (seconds: number): string =>
    `${Math.floor(seconds / 60)}:${(seconds % 60).toString().padStart(2, "0")}`;

const getSecondsLeft = (): number =>
    voteEndsAt === undefined ? 0 : Math.max(0, Math.ceil(voteEndsAt - Instance.GetGameTime()));

const getVoterName = (slot: number): string =>
    fakeVoterNames[slot] ?? Instance.GetPlayerController(slot)?.GetPlayerName() ?? "?";

const addFakeVotes = (map: string): void => {
    for (let i = 0; i < DEBUG_FAKE_VOTES_PER_VOTE; i++) {
        const fakeSlot = -(Object.keys(fakeVoterNames).length + 1);
        fakeVoterNames[fakeSlot] = `Fake Voter ${-fakeSlot}`;
        votes[fakeSlot] = map;
    }
};

const getHumanSlots = (): number[] =>
    Instance.GetAllPlayerControllers().filter((controller) => !controller.IsBot()).map((controller) => controller.GetPlayerSlot());

const renderStartButton = (): void => {
    const layout = getMainMenuLayout();
    if (!layout) return;

    layout.SetHasClass(START_BUTTON_ID, "VoteMode", true);
    layout.SetHasClass(START_BUTTON_ID, "Disabled", voteEndsAt === undefined);

    const secondsLeft = getSecondsLeft();
    lastRenderedSecondsLeft = secondsLeft;
    layout.SetDialogVariableString(START_BUTTON_ID, "label", voteEndsAt === undefined ? "WAITING FOR VOTES" : `STARTS IN ${formatCountdown(secondsLeft)}`);
};

// Every map card shows its vote count and who voted for it; each player additionally sees their
// own pick highlighted (a per-player override of the card's "Selected" class).
const renderVotes = (): void => {
    const layout = getMainMenuLayout();
    if (!layout) return;

    const votersByMap: Record<string, string[]> = {};
    for (const slot of Object.keys(votes).map(Number)) {
        (votersByMap[votes[slot]] ??= []).push(getVoterName(slot));
    }

    const humanSlots = getHumanSlots();
    for (const map of mapselect.getMaps()) {
        const buttonId = MAP_BUTTON_PREFIX + map;
        const voters = votersByMap[map] ?? [];
        layout.SetHasClass(buttonId, "HasVotes", voters.length > 0);
        layout.SetDialogVariableString(buttonId, "votes", voters.length > 0 ? `${voters.length} ${voters.length === 1 ? "VOTE" : "VOTES"}: ${voters.join(", ")}` : "");

        for (const slot of humanSlots) {
            if (votes[slot] === undefined) {
                layout.SetHasClassForPlayer(slot, buttonId, "Selected");
            } else {
                layout.SetHasClassForPlayer(slot, buttonId, "Selected", votes[slot] === map);
            }
        }
    }
};

export const render = (): void => {
    renderVotes();
    renderStartButton();
};

const pickWinner = (): string => {
    const counts: Record<string, number> = {};
    for (const map of Object.values(votes)) {
        counts[map] = (counts[map] ?? 0) + 1;
    }

    const mostVotes = Math.max(0, ...Object.values(counts));
    const leaders = Object.keys(counts).filter((map) => counts[map] === mostVotes);
    // Everyone who voted left before the timer ran out - fall back to the pre-picked random map.
    if (leaders.length === 0) return mapselect.getSelectedMap();
    return leaders[Math.floor(Math.random() * leaders.length)];
};

const stopCountdown = (): void => {
    tickGeneration++;
    voteEndsAt = undefined;
    lastRenderedSecondsLeft = undefined;
};

const finishVote = (): void => {
    const winner = pickWinner();
    const winnerVotes = Object.values(votes).filter((map) => map === winner).length;
    stopCountdown();
    printToChat(`Map vote finished - starting ${formatMapName(winner)} (${winnerVotes} ${winnerVotes === 1 ? "vote" : "votes"})`);
    onVoteFinished(winner);
};

const tick = (generation: number): void => {
    if (generation !== tickGeneration || voteEndsAt === undefined) return;
    if (getGameHasStarted()) return stopCountdown();

    const secondsLeft = getSecondsLeft();
    if (secondsLeft <= 0) return finishVote();

    if (secondsLeft !== lastRenderedSecondsLeft) renderStartButton();
    timers.setTimeout(() => tick(generation), TICK_INTERVAL_SECONDS);
};

const startTicking = (): void => {
    tickGeneration++;
    tick(tickGeneration);
};

// Called by mainMenu.ts when a player clicks a map card in vote mode. Clicking a different map
// changes the player's vote; there's no way to withdraw it entirely.
export const castVote = (player: CSPlayerController, map: string): void => {
    if (getGameHasStarted() || player.IsBot() || !mapselect.getMaps().includes(map)) return;

    const slot = player.GetPlayerSlot();
    const previous = votes[slot];
    if (previous === map) return;
    votes[slot] = map;
    addFakeVotes(map);

    playSoundForPlayer(CLICK_SOUND_NAME, slot);

    if (voteEndsAt === undefined) {
        voteEndsAt = Instance.GetGameTime() + MAP_VOTE_DURATION_SECONDS;
        printToChat(`Map vote started - the most voted map starts in ${MAP_VOTE_DURATION_SECONDS} seconds`);
        startTicking();
    }
    render();
};

// Drops every vote and stops the countdown - used when the menu is (re)opened and when a host
// takes over via but_set_host. Clears the per-player highlights too, since they'd otherwise keep
// overriding the host's own map selection highlight.
export const reset = (): void => {
    stopCountdown();
    votes = {};
    fakeVoterNames = {};

    const layout = getMainMenuLayout();
    if (!layout) return;

    const humanSlots = getHumanSlots();
    for (const map of mapselect.getMaps()) {
        const buttonId = MAP_BUTTON_PREFIX + map;
        layout.SetHasClass(buttonId, "HasVotes", false);
        layout.SetDialogVariableString(buttonId, "votes", "");
        for (const slot of humanSlots) {
            layout.SetHasClassForPlayer(slot, buttonId, "Selected");
        }
    }
};

// Registered via index.ts's shared Instance.OnPlayerDisconnect dispatch - a departed player's vote
// stops counting, and if nobody's vote is left the countdown goes back to waiting.
export const onPlayerDisconnect = (event: { playerSlot: number }): void => {
    const layout = getMainMenuLayout();
    for (const map of mapselect.getMaps()) {
        layout?.SetHasClassForPlayer(event.playerSlot, MAP_BUTTON_PREFIX + map, "Selected");
    }

    if (votes[event.playerSlot] === undefined) return;
    delete votes[event.playerSlot];

    if (Object.keys(votes).length === 0 && voteEndsAt !== undefined) {
        stopCountdown();
        printToChat("Map vote cancelled - no votes left");
    }
    if (isVoteMode() && !getGameHasStarted()) render();
};

persistOnReload("mapvote", {
    votes: { get: () => votes, set: (value) => { votes = value; } },
    voteEndsAt: { get: () => voteEndsAt, set: (value) => { voteEndsAt = value; } },
    fakeVoterNames: { get: () => fakeVoterNames, set: (value) => { fakeVoterNames = value; } },
}, () => {
    // The timers module drops queued callbacks on reload, so the tick chain has to be restarted.
    if (voteEndsAt !== undefined) startTicking();
    if (isVoteMode() && !getGameHasStarted()) render();
});
