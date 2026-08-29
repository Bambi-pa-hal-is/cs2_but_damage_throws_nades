import { CSPlayerController, CustomHudLayout, Instance } from "cs_script/point_script";
import { getMainMenuLayout } from "../shared/hud";
import { getGameHasStarted } from "../shared/gamestate";
import * as mapselect from "./mapselect";
import * as teamconfiguration from "./teamconfiguration";
import * as rules from "./throwNadesOnDamageUi";
import { beginGame } from "./gameflow";
import * as timers from "../shared/timers";

// "playerController[0]" - only whoever currently occupies player slot 0 may interact with the menu.
// Everyone else still sees it (it's never hidden for them), they just can't click into it.
const HOST_PLAYER_SLOT = 0;

const ROOT_PANEL_ID = "main_menu_root";
const START_BUTTON_ID = "start_game_button";
const START_SPINNER_ID = "start_spinner";
const FOOTER_BAR_ID = "footer_bar";
const TAB_BAR_ID = "tab_bar";
const COUNTDOWN_VALUE_ID = "countdown_value";
const COUNTDOWN_SECONDS = 3;

// Bumped every time a countdown (real or previewed) starts, so a stale recursive timer chain from
// a superseded run can tell it's been superseded and stop instead of fighting over the HUD.
let countdownGeneration = 0;
// True once the real Start Game flow has been kicked off - once set, clicking the Starting tab
// just switches to it without restarting/overriding that countdown with a preview one.
let realStartTriggered = false;

type Tab = "map" | "teams" | "rules" | "starting";

const TAB_PANEL_ID: Record<Tab, string> = { map: "panel_map", teams: "panel_teams", rules: "panel_rules", starting: "panel_starting" };
const TAB_BUTTON_ID: Record<Tab, string> = { map: "tab_map", teams: "tab_teams", rules: "tab_rules", starting: "tab_starting" };

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

// Grants input capture (cursor + click detection) to whichever player currently occupies slot 0,
// and explicitly revokes it from everyone else. Also revoked from everyone once the game has
// started, since the menu is hidden at that point anyway.
export const refreshInputCapture = (): void => {
    const layout = getMainMenuLayout();
    if (!layout) return;

    const started = getGameHasStarted();
    for (const controller of Instance.GetAllPlayerControllers()) {
        const slot = controller.GetPlayerSlot();
        layout.SetInputCaptureEnabled(slot, !started && slot === HOST_PLAYER_SLOT);
    }
};

const resetMenuChrome = (layout: CustomHudLayout): void => {
    realStartTriggered = false;
    countdownGeneration++;
    setActiveTab(layout, "map");
    layout.SetHasClass(TAB_BAR_ID, "Hidden", false);
    layout.SetHasClass(START_BUTTON_ID, "Disabled", false);
    layout.SetHasClass(START_SPINNER_ID, "Hidden", true);
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
    if (!layout) return;

    layout.SetHasClass(ROOT_PANEL_ID, "Hidden", false);
    resetMenuChrome(layout);
    refreshInputCapture();

    mapselect.renderHud();
    teamconfiguration.renderHud();
    rules.renderRules();
};

export const onRoundStart = (): void => {
    const layout = getMainMenuLayout();
    if (!layout) return;

    if (getGameHasStarted()) {
        layout.SetHasClass(ROOT_PANEL_ID, "Hidden", true);
    } else {
        layout.SetHasClass(ROOT_PANEL_ID, "Hidden", false);
        resetMenuChrome(layout);
    }
    refreshInputCapture();
};

// Exported instead of self-registered via Instance.OnPlayerActivate - index.ts owns the shared
// OnPlayerActivate dispatch.
export const onPlayerActivate = (_event: { player: CSPlayerController }): void => {
    refreshInputCapture();
};

const onStartGameClicked = (layout: CustomHudLayout): void => {
    if (getGameHasStarted() || realStartTriggered) return;
    realStartTriggered = true;

    layout.SetHasClass(START_BUTTON_ID, "Disabled", true);
    layout.SetHasClass(TAB_BAR_ID, "Hidden", true);
    setActiveTab(layout, "starting");

    // Kick the real map load off immediately - it no longer waits on the countdown below. The
    // countdown still plays for show, and if the (variable-length) real load is still going once
    // it runs out, the spinner takes over as the fallback "still loading" indicator.
    beginGame(() => {
        layout.SetHasClass(ROOT_PANEL_ID, "Hidden", true);
    });

    // beginGame() sets gameHasStarted synchronously, before the chosen map finishes loading -
    // revoke the host's input capture right away so they can't click anything else mid-load.
    refreshInputCapture();

    startCountdown(layout, () => {
        layout.SetHasClass(START_SPINNER_ID, "Hidden", false);
    });
};

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
export const onCustomHudClicked = (event: { player: CSPlayerController, layout: CustomHudLayout, buttonId: string }): void => {
    const layout = getMainMenuLayout();
    if (!layout || event.layout !== layout) return;
    // Defensive - SetInputCaptureEnabled already keeps everyone else from generating this event.
    if (event.player.GetPlayerSlot() !== HOST_PLAYER_SLOT) return;
    if (getGameHasStarted()) return;

    const id = event.buttonId;

    if (id === TAB_BUTTON_ID.map) return setActiveTab(layout, "map");
    if (id === TAB_BUTTON_ID.teams) return setActiveTab(layout, "teams");
    if (id === TAB_BUTTON_ID.rules) return setActiveTab(layout, "rules");
    if (id === TAB_BUTTON_ID.starting) return previewStartingTab(layout);

    if (id.startsWith(MAP_BUTTON_PREFIX)) return mapselect.selectMap(id.substring(MAP_BUTTON_PREFIX.length));

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
        case START_BUTTON_ID: return onStartGameClicked(layout);
    }
};
