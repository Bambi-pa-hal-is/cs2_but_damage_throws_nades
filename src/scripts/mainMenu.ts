import { CSPlayerController, CustomHudLayout, Instance } from "cs_script/point_script";
import { getMainMenuLayout } from "../shared/hud";
import { getGameHasStarted } from "../shared/gamestate";
import * as mapselect from "./mapselect";
import * as teamconfiguration from "./teamconfiguration";
import * as rules from "./throwNadesOnDamageUi";
import { beginGame } from "./gameflow";

// "playerController[0]" - only whoever currently occupies player slot 0 may interact with the menu.
// Everyone else still sees it (it's never hidden for them), they just can't click into it.
const HOST_PLAYER_SLOT = 0;

const ROOT_PANEL_ID = "main_menu_root";
const START_BUTTON_ID = "start_game_button";
const START_SPINNER_ID = "start_spinner";

type Tab = "map" | "teams" | "rules";

const TAB_PANEL_ID: Record<Tab, string> = { map: "panel_map", teams: "panel_teams", rules: "panel_rules" };
const TAB_BUTTON_ID: Record<Tab, string> = { map: "tab_map", teams: "tab_teams", rules: "tab_rules" };

const MAP_BUTTON_PREFIX = "map_";
const TEAM_CT_BUTTON_PREFIX = "team_slot_ct_";
const TEAM_T_BUTTON_PREFIX = "team_slot_t_";

const setActiveTab = (layout: CustomHudLayout, tab: Tab): void => {
    for (const key of Object.keys(TAB_PANEL_ID) as Tab[]) {
        layout.SetHasClass(TAB_PANEL_ID[key], "Hidden", key !== tab);
        layout.SetHasClass(TAB_BUTTON_ID[key], "Active", key === tab);
    }
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
    setActiveTab(layout, "map");
    layout.SetHasClass(START_BUTTON_ID, "Disabled", false);
    layout.SetHasClass(START_SPINNER_ID, "Hidden", true);
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
    if (getGameHasStarted()) return;

    layout.SetHasClass(START_BUTTON_ID, "Disabled", true);
    layout.SetHasClass(START_SPINNER_ID, "Hidden", false);

    beginGame(() => {
        layout.SetHasClass(ROOT_PANEL_ID, "Hidden", true);
    });

    // beginGame() sets gameHasStarted synchronously, before the chosen map finishes loading -
    // revoke the host's input capture right away so they can't double-click Start mid-load.
    refreshInputCapture();
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
