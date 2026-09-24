import { CSPlayerController, CustomHudLayout, Instance } from "cs_script/point_script";
import { getMainMenuLayout } from "../shared/hud";
import { getGameHasStarted, isLobbyMap } from "../shared/gamestate";
import * as mapselect from "./mapselect";
import * as teamconfiguration from "./teamconfiguration";
import * as rules from "./throwNadesOnDamageUi";
import * as mapvote from "./mapvote";
import { beginGame } from "./gameflow";
import { getHostSlot, isVoteMode } from "./hostControl";
import * as timers from "../shared/timers";

// Only the host (see hostControl.ts) may configure the match - everyone else still sees the menu,
// they just can't click into it. With no host (vote mode), every player can click, but only to
// vote on the map and browse the tabs.

const ROOT_PANEL_ID = "main_menu_root";
const START_BUTTON_ID = "start_game_button";
const START_SPINNER_ID = "start_spinner";
const FOOTER_BAR_ID = "footer_bar";
const TAB_BAR_ID = "tab_bar";
const COUNTDOWN_VALUE_ID = "countdown_value";
const COUNTDOWN_SECONDS = 3;
const FOOTER_HINT_ID = "footer_hint";
const HOST_HINT = "Configure the rules, then start when ready.";
const VOTE_HINT = "Click a map to vote for it - you can change your vote until the match starts. Default rules apply.";

// Bumped every time a countdown (real or previewed) starts, so a stale recursive timer chain from
// a superseded run can tell it's been superseded and stop instead of fighting over the HUD.
let countdownGeneration = 0;
// True once the real Start Game flow has been kicked off - once set, clicking the Starting tab
// just switches to it without restarting/overriding that countdown with a preview one.
let realStartTriggered = false;
// Tracks whether the menu is currently up, so onRoundStart() can tell "menu just reappeared after
// being hidden" (reset the chrome/active tab) apart from "menu was already up and a routine
// warmup round restart fired" (leave whatever tab the host is on alone).
let menuVisible = false;

type Tab = "map" | "teams" | "rules" | "bots" | "starting";

const TAB_PANEL_ID: Record<Tab, string> = { map: "panel_map", teams: "panel_teams", rules: "panel_rules", bots: "panel_bots", starting: "panel_starting" };
const TAB_BUTTON_ID: Record<Tab, string> = { map: "tab_map", teams: "tab_teams", rules: "tab_rules", bots: "tab_bots", starting: "tab_starting" };

const MAP_BUTTON_PREFIX = "map_";
const TEAM_CT_BUTTON_PREFIX = "team_slot_ct_";
const TEAM_T_BUTTON_PREFIX = "team_slot_t_";

const setActiveTab = (layout: CustomHudLayout, tab: Tab): void => {
    for (const key of Object.keys(TAB_PANEL_ID) as Tab[]) {
        layout.SetHasClass(TAB_PANEL_ID[key], "Hidden", key !== tab);
        layout.SetHasClass(TAB_BUTTON_ID[key], "Active", key === tab);
    }
    // The footer (rules hint + Start Game button) doesn't belong on the starting/countdown screen.
    layout.SetHasClass(FOOTER_BAR_ID, "Hidden", tab === "starting");
};

// Vote mode: every player browses the tabs on their own, so a tab click only switches it for
// whoever clicked. Never used for the starting tab, so the footer stays global.
const setActiveTabForPlayer = (layout: CustomHudLayout, playerSlot: number, tab: Tab): void => {
    for (const key of Object.keys(TAB_PANEL_ID) as Tab[]) {
        layout.SetHasClassForPlayer(playerSlot, TAB_PANEL_ID[key], "Hidden", key !== tab);
        layout.SetHasClassForPlayer(playerSlot, TAB_BUTTON_ID[key], "Active", key === tab);
    }
};

// Drops every setActiveTabForPlayer() override so the global setActiveTab() state shows again.
const clearPlayerTabOverrides = (layout: CustomHudLayout): void => {
    for (const controller of Instance.GetAllPlayerControllers()) {
        const slot = controller.GetPlayerSlot();
        for (const key of Object.keys(TAB_PANEL_ID) as Tab[]) {
            layout.SetHasClassForPlayer(slot, TAB_PANEL_ID[key], "Hidden");
            layout.SetHasClassForPlayer(slot, TAB_BUTTON_ID[key], "Active");
        }
    }
};

// Grants input capture (cursor + click detection) to the host, or to every real player in vote
// mode, and explicitly revokes it from everyone else. Also revoked from everyone once the game has
// started, since the menu is hidden at that point anyway.
export const refreshInputCapture = (): void => {
    const layout = getMainMenuLayout();
    if (!layout) return;

    const started = getGameHasStarted();
    const hostSlot = getHostSlot();
    for (const controller of Instance.GetAllPlayerControllers()) {
        const slot = controller.GetPlayerSlot();
        const canInteract = hostSlot === undefined ? !controller.IsBot() : slot === hostSlot;
        layout.SetInputCaptureEnabled(slot, !started && canInteract);
    }
};

// Footer hint + Start Game button for the current control mode. In vote mode the button is a
// read-only countdown owned by mapvote.ts.
const renderControlMode = (layout: CustomHudLayout): void => {
    const voteMode = isVoteMode();
    layout.SetDialogVariableString(FOOTER_HINT_ID, "hint", voteMode ? VOTE_HINT : HOST_HINT);

    if (voteMode) {
        mapvote.render();
    } else {
        layout.SetHasClass(START_BUTTON_ID, "VoteMode", false);
        layout.SetHasClass(START_BUTTON_ID, "Disabled", realStartTriggered);
        layout.SetDialogVariableString(START_BUTTON_ID, "label", "START GAME");
    }

    mapselect.renderHud();
    refreshInputCapture();
};

// Called when but_set_host picks a host, or when that host disconnects again.
export const onControlModeChanged = (): void => {
    const layout = getMainMenuLayout();
    if (!layout) return;

    // A host taking over ends any vote in progress - they pick the map from here on.
    if (!isVoteMode()) mapvote.reset();
    clearPlayerTabOverrides(layout);
    renderControlMode(layout);
};

const hideMenu = (layout: CustomHudLayout): void => {
    layout.SetHasClass(ROOT_PANEL_ID, "Hidden", true);
    menuVisible = false;
};

const resetMenuChrome = (layout: CustomHudLayout): void => {
    realStartTriggered = false;
    countdownGeneration++;
    mapvote.reset();
    clearPlayerTabOverrides(layout);

    // On a real map there's no map to pick, and bots already work - both tabs only make sense in
    // the lobby.
    const lobby = isLobbyMap();
    layout.SetHasClass(TAB_BUTTON_ID.map, "Hidden", !lobby);
    layout.SetHasClass(TAB_BUTTON_ID.bots, "Hidden", !lobby);
    setActiveTab(layout, lobby ? "map" : "rules");
    layout.SetHasClass(TAB_BAR_ID, "Hidden", false);
    layout.SetHasClass(START_SPINNER_ID, "Hidden", true);
    renderControlMode(layout);
};

// Counts down from COUNTDOWN_SECONDS to 1 (one second per step), then calls onComplete. `generation`
// is the countdownGeneration this particular run was started under - if something else (a fresh
// preview click, or a reset) has since bumped countdownGeneration, this stale chain quietly stops
// instead of continuing to write over whatever the newer run is showing.
const runCountdown = (layout: CustomHudLayout, secondsLeft: number, onComplete: () => void, generation: number): void => {
    if (generation !== countdownGeneration) return;

    if (secondsLeft <= 0) {
        onComplete();
        return;
    }
    layout.SetDialogVariableString(COUNTDOWN_VALUE_ID, "value", secondsLeft.toString());
    timers.setTimeout(() => runCountdown(layout, secondsLeft - 1, onComplete, generation), 1);
};

// Starts a fresh countdown run, superseding any previous one (real or previewed).
const startCountdown = (layout: CustomHudLayout, onComplete: () => void): void => {
    countdownGeneration++;
    runCountdown(layout, COUNTDOWN_SECONDS, onComplete, countdownGeneration);
};

export const onActivate = (): void => {
    const layout = getMainMenuLayout();
    if (!layout) {
        Instance.Msg("mainMenu.onActivate: main_menu_layout not found - menu setup skipped");
        return;
    }

    // startgame.onActivate() already started the match (dedicated server on a real map).
    if (getGameHasStarted()) {
        hideMenu(layout);
        refreshInputCapture();
        return;
    }

    layout.SetHasClass(ROOT_PANEL_ID, "Hidden", false);
    menuVisible = true;
    resetMenuChrome(layout);

    teamconfiguration.renderHud();
    rules.renderRules();
};

export const onRoundStart = (): void => {
    const layout = getMainMenuLayout();
    if (!layout) return;

    if (getGameHasStarted()) {
        hideMenu(layout);
    } else if (!menuVisible) {
        // Only reset the chrome (active tab, start button/spinner state) the first time the menu
        // reappears after being hidden. Warmup round-starts fire repeatedly while the lobby is up -
        // without this guard, every one of them would yank the host back to the Map tab mid-click.
        layout.SetHasClass(ROOT_PANEL_ID, "Hidden", false);
        resetMenuChrome(layout);
        menuVisible = true;
    }
    refreshInputCapture();
};

// Exported instead of self-registered via Instance.OnPlayerActivate - index.ts owns the shared
// OnPlayerActivate dispatch.
export const onPlayerActivate = (_event: { player: CSPlayerController }): void => {
    refreshInputCapture();
};

// Shared by the host's Start Game button and the end of a map vote.
const startMatch = (layout: CustomHudLayout): void => {
    if (getGameHasStarted() || realStartTriggered) return;
    realStartTriggered = true;

    clearPlayerTabOverrides(layout);

    // On a real map there's nothing to load - just close the menu and start with the chosen rules.
    if (!isLobbyMap()) {
        hideMenu(layout);
        beginGame(() => {});
        refreshInputCapture();
        return;
    }

    layout.SetHasClass(START_BUTTON_ID, "Disabled", true);
    layout.SetHasClass(TAB_BAR_ID, "Hidden", true);
    setActiveTab(layout, "starting");

    // Kick the real map load off immediately - it no longer waits on the countdown below. The
    // countdown still plays for show, and if the (variable-length) real load is still going once
    // it runs out, the spinner takes over as the fallback "still loading" indicator.
    beginGame(() => hideMenu(layout));

    // beginGame() sets gameHasStarted synchronously, before the chosen map finishes loading -
    // revoke the host's input capture right away so they can't click anything else mid-load.
    refreshInputCapture();

    startCountdown(layout, () => {
        layout.SetHasClass(START_SPINNER_ID, "Hidden", false);
    });
};

mapvote.setOnVoteFinished((winningMap) => {
    const layout = getMainMenuLayout();
    if (!layout) return;
    mapselect.selectMap(winningMap);
    startMatch(layout);
});

// Lets the host preview the countdown by clicking the Starting tab directly, without it actually
// beginning the game - a no-op if a real start is already in progress (that tab just gets shown
// as-is then, rather than restarting/overriding the real countdown with a preview one).
const previewStartingTab = (layout: CustomHudLayout): void => {
    setActiveTab(layout, "starting");
    if (!realStartTriggered) {
        startCountdown(layout, () => {});
    }
};

// Exported instead of self-registered via Instance.OnCustomHudClicked - only one callback can be
// registered per event name, and index.ts owns the shared OnCustomHudClicked dispatch.
// Vote mode clicks: tabs switch per player, map cards cast/change that player's vote, and
// everything else (rules, teams, start button) is read-only.
const onVoteModeClick = (layout: CustomHudLayout, player: CSPlayerController, id: string): void => {
    if (realStartTriggered) return;
    const slot = player.GetPlayerSlot();

    if (id === TAB_BUTTON_ID.map) return setActiveTabForPlayer(layout, slot, "map");
    if (id === TAB_BUTTON_ID.teams) return setActiveTabForPlayer(layout, slot, "teams");
    if (id === TAB_BUTTON_ID.rules) return setActiveTabForPlayer(layout, slot, "rules");
    if (id === TAB_BUTTON_ID.bots) return setActiveTabForPlayer(layout, slot, "bots");

    if (id.startsWith(MAP_BUTTON_PREFIX)) return mapvote.castVote(player, id.substring(MAP_BUTTON_PREFIX.length));
};

export const onCustomHudClicked = (event: { player: CSPlayerController, layout: CustomHudLayout, buttonId: string }): void => {
    const layout = getMainMenuLayout();
    if (!layout || event.layout !== layout) return;
    if (getGameHasStarted()) return;

    const id = event.buttonId;
    const hostSlot = getHostSlot();
    if (hostSlot === undefined) return onVoteModeClick(layout, event.player, id);
    // Defensive - SetInputCaptureEnabled already keeps everyone else from generating this event.
    if (event.player.GetPlayerSlot() !== hostSlot) return;

    if (id === TAB_BUTTON_ID.map && isLobbyMap()) return setActiveTab(layout, "map");
    if (id === TAB_BUTTON_ID.teams) return setActiveTab(layout, "teams");
    if (id === TAB_BUTTON_ID.rules) return setActiveTab(layout, "rules");
    if (id === TAB_BUTTON_ID.bots) return setActiveTab(layout, "bots");
    if (id === TAB_BUTTON_ID.starting) return previewStartingTab(layout);

    if (id.startsWith(MAP_BUTTON_PREFIX) && isLobbyMap()) return mapselect.selectMap(id.substring(MAP_BUTTON_PREFIX.length));

    if (id.startsWith(TEAM_CT_BUTTON_PREFIX)) {
        return teamconfiguration.handleSlotClick("ct", Number(id.substring(TEAM_CT_BUTTON_PREFIX.length)));
    }
    if (id.startsWith(TEAM_T_BUTTON_PREFIX)) {
        return teamconfiguration.handleSlotClick("t", Number(id.substring(TEAM_T_BUTTON_PREFIX.length)));
    }

    switch (id) {
        case "rule_toggle_throw_on_shoot": return rules.toggleThrowOnShoot();
        case "rule_toggle_throw_on_damage": return rules.toggleThrowOnDamage();
        case "rule_toggle_he": return rules.toggleHe();
        case "rule_toggle_flashbang": return rules.toggleFlashbang();
        case "rule_toggle_smoke": return rules.toggleSmoke();
        case "rule_toggle_molotov": return rules.toggleMolotov();
        case "rule_toggle_decoy": return rules.toggleDecoy();
        case "rule_toggle_only_equipped": return rules.toggleOnlyEquipped();
        case "rule_shoot_chance_inc": return rules.incrementShootChance();
        case "rule_shoot_chance_dec": return rules.decrementShootChance();
        case "rule_damage_chance_inc": return rules.incrementDamageChance();
        case "rule_damage_chance_dec": return rules.decrementDamageChance();
        case "rule_health_inc": return rules.incrementHealth();
        case "rule_health_dec": return rules.decrementHealth();
        case START_BUTTON_ID: return startMatch(layout);
    }
};
