import { BaseModelEntity, Instance, type CSPlayerPawn } from "cs_script/point_script";
import { persistOnReload } from "../shared/persist";
import { setEntityMessageByName } from "../shared/ui";
import { getMainMenuLayout } from "../shared/hud";
import { getConfiguration } from "./throwNadesOnDamage";

const HEALTH_STEP = 10;
const CHANCE_STEP = 0.01;

const updateHealthText = (health: number) => {
    setEntityMessageByName("player_health_text", health.toString());
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

const updateCheck = (show: boolean, entityName: string, hudButtonId: string) => {
    const check = Instance.FindEntityByName(entityName + "_check");
    if (check instanceof BaseModelEntity) {
        const size = show ? 1.0 : 0.0;
        check.SetModelScale(size);
    }
    getMainMenuLayout()?.SetHasClass(hudButtonId, "Checked", show);
};

const updatePercentageText = (entityName: string, hudPanelId: string, percent: number) => {
    const text = Math.floor(percent * 100) + "%";
    setEntityMessageByName(entityName, text);
    getMainMenuLayout()?.SetDialogVariableString(hudPanelId, "value", text);
};

export const renderRules = () => {
    const configuration = getConfiguration();
    updateCheck(configuration.throwGrenadeWhenShooting, "throw_a_nade_when_shooting_button", "rule_toggle_throw_on_shoot");
    updateCheck(configuration.throwGrenadeWhenDealingDamage, "throw_a_nade_when_dealing_damage_button", "rule_toggle_throw_on_damage");
    updateCheck(configuration.isHeAllowed, "allow_he_button", "rule_toggle_he");
    updateCheck(configuration.isFlashbangAllowed, "allow_flashbang_button", "rule_toggle_flashbang");
    updateCheck(configuration.isSmokeAllowed, "allow_smoke_button", "rule_toggle_smoke");
    updateCheck(configuration.isMolotovAllowed, "allow_molotov_button", "rule_toggle_molotov");
    updateCheck(configuration.isDecoyAllowed, "allow_decoy_button", "rule_toggle_decoy");
    updateCheck(configuration.onlyEquippedNades, "only_random_equipped_nades_button", "rule_toggle_only_equipped");
    updatePercentageText("chance_to_throw_nade_when_shooting_text", "rule_shoot_chance_value", configuration.chanceToThrowGrenadeWhenShooting);
    updatePercentageText("chance_to_throw_nade_when_dealing_damage_text", "rule_damage_chance_value", configuration.chanceToThrowGrenadeWhenDealingDamage);
    updateHealthText(configuration.playerHealth);
    applyHealthToAllPlayers();
};

export const onRoundStart = () => {
    renderRules();
};

// throwNadesOnDamage.ts's configuration can change (or get restored) on a tools-mode script
// reload without this module getting re-evaluated, so the world entities/HUD can drift out of sync
// with it - repaint them from the current configuration whenever that reload happens.
persistOnReload("throwNadesOnDamageUi", {}, onRoundStart);

const clamp01 = (value: number) => Math.min(1.0, Math.max(0.0, value));

export const toggleThrowOnShoot = () => {
    const configuration = getConfiguration();
    configuration.throwGrenadeWhenShooting = !configuration.throwGrenadeWhenShooting;
    updateCheck(configuration.throwGrenadeWhenShooting, "throw_a_nade_when_shooting_button", "rule_toggle_throw_on_shoot");
};

export const toggleThrowOnDamage = () => {
    const configuration = getConfiguration();
    configuration.throwGrenadeWhenDealingDamage = !configuration.throwGrenadeWhenDealingDamage;
    updateCheck(configuration.throwGrenadeWhenDealingDamage, "throw_a_nade_when_dealing_damage_button", "rule_toggle_throw_on_damage");
};

export const incrementShootChance = () => {
    const configuration = getConfiguration();
    configuration.chanceToThrowGrenadeWhenShooting = clamp01(configuration.chanceToThrowGrenadeWhenShooting + CHANCE_STEP);
    updatePercentageText("chance_to_throw_nade_when_shooting_text", "rule_shoot_chance_value", configuration.chanceToThrowGrenadeWhenShooting);
};

export const decrementShootChance = () => {
    const configuration = getConfiguration();
    configuration.chanceToThrowGrenadeWhenShooting = clamp01(configuration.chanceToThrowGrenadeWhenShooting - CHANCE_STEP);
    updatePercentageText("chance_to_throw_nade_when_shooting_text", "rule_shoot_chance_value", configuration.chanceToThrowGrenadeWhenShooting);
};

export const incrementDamageChance = () => {
    const configuration = getConfiguration();
    configuration.chanceToThrowGrenadeWhenDealingDamage = clamp01(configuration.chanceToThrowGrenadeWhenDealingDamage + CHANCE_STEP);
    updatePercentageText("chance_to_throw_nade_when_dealing_damage_text", "rule_damage_chance_value", configuration.chanceToThrowGrenadeWhenDealingDamage);
};

export const decrementDamageChance = () => {
    const configuration = getConfiguration();
    configuration.chanceToThrowGrenadeWhenDealingDamage = clamp01(configuration.chanceToThrowGrenadeWhenDealingDamage - CHANCE_STEP);
    updatePercentageText("chance_to_throw_nade_when_dealing_damage_text", "rule_damage_chance_value", configuration.chanceToThrowGrenadeWhenDealingDamage);
};

export const toggleHe = () => {
    const configuration = getConfiguration();
    configuration.isHeAllowed = !configuration.isHeAllowed;
    updateCheck(configuration.isHeAllowed, "allow_he_button", "rule_toggle_he");
};

export const toggleFlashbang = () => {
    const configuration = getConfiguration();
    configuration.isFlashbangAllowed = !configuration.isFlashbangAllowed;
    updateCheck(configuration.isFlashbangAllowed, "allow_flashbang_button", "rule_toggle_flashbang");
};

export const toggleSmoke = () => {
    const configuration = getConfiguration();
    configuration.isSmokeAllowed = !configuration.isSmokeAllowed;
    updateCheck(configuration.isSmokeAllowed, "allow_smoke_button", "rule_toggle_smoke");
};

export const toggleMolotov = () => {
    const configuration = getConfiguration();
    configuration.isMolotovAllowed = !configuration.isMolotovAllowed;
    updateCheck(configuration.isMolotovAllowed, "allow_molotov_button", "rule_toggle_molotov");
};

export const toggleDecoy = () => {
    const configuration = getConfiguration();
    configuration.isDecoyAllowed = !configuration.isDecoyAllowed;
    updateCheck(configuration.isDecoyAllowed, "allow_decoy_button", "rule_toggle_decoy");
};

export const toggleOnlyEquipped = () => {
    const configuration = getConfiguration();
    configuration.onlyEquippedNades = !configuration.onlyEquippedNades;
    updateCheck(configuration.onlyEquippedNades, "only_random_equipped_nades_button", "rule_toggle_only_equipped");
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

// --- legacy in-world buttons - kept so the original func_button/model UI keeps working, now
// simply routed through the same handlers the HUD uses ---
Instance.OnScriptInput("toggle_throw_nade_when_shooting", toggleThrowOnShoot);
Instance.OnScriptInput("toggle_throw_nade_when_dealing_damage", toggleThrowOnDamage);
Instance.OnScriptInput("throw_a_nade_when_shooting_increment_chance_press", incrementShootChance);
Instance.OnScriptInput("throw_a_nade_when_shooting_decrement_chance_press", decrementShootChance);
Instance.OnScriptInput("throw_a_nade_when_dealing_damage_increment_chance_press", incrementDamageChance);
Instance.OnScriptInput("throw_a_nade_when_dealing_damage_decrement_chance_press", decrementDamageChance);
Instance.OnScriptInput("toggle_he", toggleHe);
Instance.OnScriptInput("toggle_flashbang", toggleFlashbang);
Instance.OnScriptInput("toggle_smoke", toggleSmoke);
Instance.OnScriptInput("toggle_molotov", toggleMolotov);
Instance.OnScriptInput("toggle_decoy", toggleDecoy);
Instance.OnScriptInput("toggle_only_equipped_nades", toggleOnlyEquipped);
Instance.OnScriptInput("player_health_increment_press", incrementHealth);
Instance.OnScriptInput("player_health_decrement_press", decrementHealth);
