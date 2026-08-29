import { Instance, type CSPlayerPawn } from "cs_script/point_script";
import { persistOnReload } from "../shared/persist";
import { getMainMenuLayout } from "../shared/hud";
import { getConfiguration } from "./throwNadesOnDamage";

const HEALTH_STEP = 10;
const CHANCE_STEP = 0.01;

const updateHealthText = (health: number) => {
    getMainMenuLayout()?.SetDialogVariableString("rule_health_value", "value", health.toString());
};

// Exported so index.ts's shared Instance.OnPlayerReset can top up a single player's health right
// as they spawn - catches late joiners whose pawn didn't exist yet during the last onRoundStart().
export const applyHealthToPlayer = (pawn: CSPlayerPawn): void => {
    const configuration = getConfiguration();
    pawn.SetMaxHealth(configuration.playerHealth);
    pawn.SetHealth(configuration.playerHealth);
};

const applyHealthToAllPlayers = () => {
    for (const controller of Instance.GetAllPlayerControllers()) {
        const pawn = controller.GetPlayerPawn();
        if (!pawn || !pawn.IsValid()) continue;
        applyHealthToPlayer(pawn);
    }
};

const updateCheck = (show: boolean, hudButtonId: string) => {
    getMainMenuLayout()?.SetHasClass(hudButtonId, "Checked", show);
};

const updatePercentageText = (hudPanelId: string, percent: number) => {
    const text = Math.floor(percent * 100) + "%";
    getMainMenuLayout()?.SetDialogVariableString(hudPanelId, "value", text);
};

export const renderRules = () => {
    const configuration = getConfiguration();
    updateCheck(configuration.throwGrenadeWhenShooting, "rule_toggle_throw_on_shoot");
    updateCheck(configuration.throwGrenadeWhenDealingDamage, "rule_toggle_throw_on_damage");
    updateCheck(configuration.isHeAllowed, "rule_toggle_he");
    updateCheck(configuration.isFlashbangAllowed, "rule_toggle_flashbang");
    updateCheck(configuration.isSmokeAllowed, "rule_toggle_smoke");
    updateCheck(configuration.isMolotovAllowed, "rule_toggle_molotov");
    updateCheck(configuration.isDecoyAllowed, "rule_toggle_decoy");
    updateCheck(configuration.onlyEquippedNades, "rule_toggle_only_equipped");
    updatePercentageText("rule_shoot_chance_value", configuration.chanceToThrowGrenadeWhenShooting);
    updatePercentageText("rule_damage_chance_value", configuration.chanceToThrowGrenadeWhenDealingDamage);
    updateHealthText(configuration.playerHealth);
    applyHealthToAllPlayers();
};

export const onRoundStart = () => {
    renderRules();
};

// throwNadesOnDamage.ts's configuration can change (or get restored) on a tools-mode script
// reload without this module getting re-evaluated, so the HUD can drift out of sync with it -
// repaint it from the current configuration whenever that reload happens.
persistOnReload("throwNadesOnDamageUi", {}, onRoundStart);

const clamp01 = (value: number) => Math.min(1.0, Math.max(0.0, value));

export const toggleThrowOnShoot = () => {
    const configuration = getConfiguration();
    configuration.throwGrenadeWhenShooting = !configuration.throwGrenadeWhenShooting;
    updateCheck(configuration.throwGrenadeWhenShooting, "rule_toggle_throw_on_shoot");
};

export const toggleThrowOnDamage = () => {
    const configuration = getConfiguration();
    configuration.throwGrenadeWhenDealingDamage = !configuration.throwGrenadeWhenDealingDamage;
    updateCheck(configuration.throwGrenadeWhenDealingDamage, "rule_toggle_throw_on_damage");
};

export const incrementShootChance = () => {
    const configuration = getConfiguration();
    configuration.chanceToThrowGrenadeWhenShooting = clamp01(configuration.chanceToThrowGrenadeWhenShooting + CHANCE_STEP);
    updatePercentageText("rule_shoot_chance_value", configuration.chanceToThrowGrenadeWhenShooting);
};

export const decrementShootChance = () => {
    const configuration = getConfiguration();
    configuration.chanceToThrowGrenadeWhenShooting = clamp01(configuration.chanceToThrowGrenadeWhenShooting - CHANCE_STEP);
    updatePercentageText("rule_shoot_chance_value", configuration.chanceToThrowGrenadeWhenShooting);
};

export const incrementDamageChance = () => {
    const configuration = getConfiguration();
    configuration.chanceToThrowGrenadeWhenDealingDamage = clamp01(configuration.chanceToThrowGrenadeWhenDealingDamage + CHANCE_STEP);
    updatePercentageText("rule_damage_chance_value", configuration.chanceToThrowGrenadeWhenDealingDamage);
};

export const decrementDamageChance = () => {
    const configuration = getConfiguration();
    configuration.chanceToThrowGrenadeWhenDealingDamage = clamp01(configuration.chanceToThrowGrenadeWhenDealingDamage - CHANCE_STEP);
    updatePercentageText("rule_damage_chance_value", configuration.chanceToThrowGrenadeWhenDealingDamage);
};

export const toggleHe = () => {
    const configuration = getConfiguration();
    configuration.isHeAllowed = !configuration.isHeAllowed;
    updateCheck(configuration.isHeAllowed, "rule_toggle_he");
};

export const toggleFlashbang = () => {
    const configuration = getConfiguration();
    configuration.isFlashbangAllowed = !configuration.isFlashbangAllowed;
    updateCheck(configuration.isFlashbangAllowed, "rule_toggle_flashbang");
};

export const toggleSmoke = () => {
    const configuration = getConfiguration();
    configuration.isSmokeAllowed = !configuration.isSmokeAllowed;
    updateCheck(configuration.isSmokeAllowed, "rule_toggle_smoke");
};

export const toggleMolotov = () => {
    const configuration = getConfiguration();
    configuration.isMolotovAllowed = !configuration.isMolotovAllowed;
    updateCheck(configuration.isMolotovAllowed, "rule_toggle_molotov");
};

export const toggleDecoy = () => {
    const configuration = getConfiguration();
    configuration.isDecoyAllowed = !configuration.isDecoyAllowed;
    updateCheck(configuration.isDecoyAllowed, "rule_toggle_decoy");
};

export const toggleOnlyEquipped = () => {
    const configuration = getConfiguration();
    configuration.onlyEquippedNades = !configuration.onlyEquippedNades;
    updateCheck(configuration.onlyEquippedNades, "rule_toggle_only_equipped");
};

export const incrementHealth = () => {
    const configuration = getConfiguration();
    configuration.playerHealth += HEALTH_STEP;
    updateHealthText(configuration.playerHealth);
    applyHealthToAllPlayers();
};

export const decrementHealth = () => {
    const configuration = getConfiguration();
    configuration.playerHealth = Math.max(HEALTH_STEP, configuration.playerHealth - HEALTH_STEP);
    updateHealthText(configuration.playerHealth);
    applyHealthToAllPlayers();
};
