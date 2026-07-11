import { BaseModelEntity, Instance } from "cs_script/point_script";
import { persistOnReload } from "../shared/persist";
import { setEntityMessageByName } from "../shared/ui";
import { getConfiguration } from "./throwNadesOnDamage";

const updateCheck = (show: boolean, entityName: string) => {
    var check = Instance.FindEntityByName(entityName + "_check");
    if(check instanceof BaseModelEntity)
    {
        var size = show ? 1.0 : 0.0;
        check.SetModelScale(size);
    }
}

const updatePercentageText = (entityName: string, percent: number) => {
    var text = Math.floor(percent * 100) + "%";
    setEntityMessageByName(entityName, text);
}

export const onRoundStart = () => {
    const configuration = getConfiguration();
    updateCheck(configuration.throwGrenadeWhenShooting, "throw_a_nade_when_shooting_button");
    updateCheck(configuration.throwGrenadeWhenDealingDamage, "throw_a_nade_when_dealing_damage_button");
    updateCheck(configuration.isHeAllowed, "allow_he_button");
    updateCheck(configuration.isFlashbangAllowed, "allow_flashbang_button");
    updateCheck(configuration.isSmokeAllowed, "allow_smoke_button");
    updateCheck(configuration.isMolotovAllowed, "allow_molotov_button");
    updateCheck(configuration.isDecoyAllowed, "allow_decoy_button");
    updateCheck(configuration.onlyEquippedNades, "only_random_equipped_nades_button");
    updatePercentageText("chance_to_throw_nade_when_shooting_text", configuration.chanceToThrowGrenadeWhenShooting);
    updatePercentageText("chance_to_throw_nade_when_dealing_damage_text", configuration.chanceToThrowGrenadeWhenDealingDamage);
};

// throwNadesOnDamage.ts's configuration can change (or get restored) on a tools-mode script
// reload without this module getting re-evaluated, so the buttons/text can drift out of sync
// with it - repaint them from the current configuration whenever that reload happens.
persistOnReload("throwNadesOnDamageUi", {}, onRoundStart);

Instance.OnScriptInput("toggle_throw_nade_when_shooting", () => {
    const configuration = getConfiguration();
    configuration.throwGrenadeWhenShooting = !configuration.throwGrenadeWhenShooting;
    updateCheck(configuration.throwGrenadeWhenShooting, "throw_a_nade_when_shooting_button");
});

Instance.OnScriptInput("toggle_throw_nade_when_dealing_damage", () => {
    const configuration = getConfiguration();
    configuration.throwGrenadeWhenDealingDamage = !configuration.throwGrenadeWhenDealingDamage;
    updateCheck(configuration.throwGrenadeWhenDealingDamage, "throw_a_nade_when_dealing_damage_button");
});

Instance.OnScriptInput("throw_a_nade_when_shooting_increment_chance_press", () => {
    const configuration = getConfiguration();
    configuration.chanceToThrowGrenadeWhenShooting += 0.01;
    configuration.chanceToThrowGrenadeWhenShooting = Math.max(configuration.chanceToThrowGrenadeWhenShooting, 0.0);
    configuration.chanceToThrowGrenadeWhenShooting = Math.min(configuration.chanceToThrowGrenadeWhenShooting, 1.0);
    updatePercentageText("chance_to_throw_nade_when_shooting_text", configuration.chanceToThrowGrenadeWhenShooting);
});
Instance.OnScriptInput("throw_a_nade_when_shooting_decrement_chance_press", () => {
    const configuration = getConfiguration();
    configuration.chanceToThrowGrenadeWhenShooting -= 0.01;
    configuration.chanceToThrowGrenadeWhenShooting = Math.max(configuration.chanceToThrowGrenadeWhenShooting, 0.0);
    configuration.chanceToThrowGrenadeWhenShooting = Math.min(configuration.chanceToThrowGrenadeWhenShooting, 1.0);
    updatePercentageText("chance_to_throw_nade_when_shooting_text", configuration.chanceToThrowGrenadeWhenShooting);
});

Instance.OnScriptInput("throw_a_nade_when_dealing_damage_increment_chance_press", () => {
    const configuration = getConfiguration();
    configuration.chanceToThrowGrenadeWhenDealingDamage += 0.01;
    configuration.chanceToThrowGrenadeWhenDealingDamage = Math.max(configuration.chanceToThrowGrenadeWhenDealingDamage, 0.0);
    configuration.chanceToThrowGrenadeWhenDealingDamage = Math.min(configuration.chanceToThrowGrenadeWhenDealingDamage, 1.0);
    updatePercentageText("chance_to_throw_nade_when_dealing_damage_text", configuration.chanceToThrowGrenadeWhenDealingDamage);
});
Instance.OnScriptInput("throw_a_nade_when_dealing_damage_decrement_chance_press", () => {
    const configuration = getConfiguration();
    configuration.chanceToThrowGrenadeWhenDealingDamage -= 0.01;
    configuration.chanceToThrowGrenadeWhenDealingDamage = Math.max(configuration.chanceToThrowGrenadeWhenDealingDamage, 0.0);
    configuration.chanceToThrowGrenadeWhenDealingDamage = Math.min(configuration.chanceToThrowGrenadeWhenDealingDamage, 1.0);
    updatePercentageText("chance_to_throw_nade_when_dealing_damage_text", configuration.chanceToThrowGrenadeWhenDealingDamage);
});

Instance.OnScriptInput("toggle_he", () => {
    const configuration = getConfiguration();
    configuration.isHeAllowed = !configuration.isHeAllowed;
    updateCheck(configuration.isHeAllowed, "allow_he_button");
});

Instance.OnScriptInput("toggle_flashbang", () => {
    const configuration = getConfiguration();
    configuration.isFlashbangAllowed = !configuration.isFlashbangAllowed;
    updateCheck(configuration.isFlashbangAllowed, "allow_flashbang_button");
});

Instance.OnScriptInput("toggle_smoke", () => {
    const configuration = getConfiguration();
    configuration.isSmokeAllowed = !configuration.isSmokeAllowed;
    updateCheck(configuration.isSmokeAllowed, "allow_smoke_button");
});

Instance.OnScriptInput("toggle_molotov", () => {
    const configuration = getConfiguration();
    configuration.isMolotovAllowed = !configuration.isMolotovAllowed;
    updateCheck(configuration.isMolotovAllowed, "allow_molotov_button");
});

Instance.OnScriptInput("toggle_decoy", () => {
    const configuration = getConfiguration();
    configuration.isDecoyAllowed = !configuration.isDecoyAllowed;
    updateCheck(configuration.isDecoyAllowed, "allow_decoy_button");
});

Instance.OnScriptInput("toggle_only_equipped_nades", () => {
    const configuration = getConfiguration();
    configuration.onlyEquippedNades = !configuration.onlyEquippedNades;
    updateCheck(configuration.onlyEquippedNades, "only_random_equipped_nades_button");
});
