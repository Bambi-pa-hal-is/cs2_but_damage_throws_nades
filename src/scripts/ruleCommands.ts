import { Instance } from "cs_script/point_script";
import { getConfiguration, ThrowNadesConfiguration } from "./throwNadesOnDamage";
import { renderRules } from "./throwNadesOnDamageUi";

// One cheat command per setting on the Rules tab. Each sets the value directly (instead of
// toggling/stepping like the HUD buttons), and running it without an argument prints the current
// value, like a convar.

type BooleanKey = { [K in keyof ThrowNadesConfiguration]: ThrowNadesConfiguration[K] extends boolean ? K : never }[keyof ThrowNadesConfiguration];

const BOOLEAN_COMMANDS: { name: string, key: BooleanKey, description: string }[] = [
    { name: "but_throw_on_shoot", key: "throwGrenadeWhenShooting", description: "Throw a nade when shooting" },
    { name: "but_throw_on_damage", key: "throwGrenadeWhenDealingDamage", description: "Throw a nade when dealing damage" },
    { name: "but_allow_he", key: "isHeAllowed", description: "Allow HE" },
    { name: "but_allow_flashbang", key: "isFlashbangAllowed", description: "Allow Flashbang" },
    { name: "but_allow_smoke", key: "isSmokeAllowed", description: "Allow Smoke" },
    { name: "but_allow_molotov", key: "isMolotovAllowed", description: "Allow Molotov / Incendiary" },
    { name: "but_allow_decoy", key: "isDecoyAllowed", description: "Allow Decoy" },
    { name: "but_only_equipped", key: "onlyEquippedNades", description: "Only random between allowed grenades the player is carrying" },
];

const CHANCE_COMMANDS: { name: string, key: "chanceToThrowGrenadeWhenShooting" | "chanceToThrowGrenadeWhenDealingDamage", description: string }[] = [
    { name: "but_shoot_chance", key: "chanceToThrowGrenadeWhenShooting", description: "Chance to throw when shooting" },
    { name: "but_damage_chance", key: "chanceToThrowGrenadeWhenDealingDamage", description: "Chance to throw when dealing damage" },
];

const HEALTH_COMMAND = "but_health";

const TRUE_VALUES = new Set(["1", "true", "on", "yes"]);
const FALSE_VALUES = new Set(["0", "false", "off", "no"]);

// The callback may or may not get the command name itself in front of the arguments - strip it if
// it's there, same as hostControl.ts does.
const parseArgument = (commandName: string, args: string): string => {
    let text = (args ?? "").trim();
    if (text.toLowerCase() === commandName || text.toLowerCase().startsWith(commandName + " ")) {
        text = text.substring(commandName.length).trim();
    }
    return text.replace(/^"(.*)"$/, "$1").trim();
};

// Only a single plain number, no trailing junk ("50abc") or empty strings (Number("") is 0).
const parseNumber = (text: string): number | undefined =>
    /^-?\d+(\.\d+)?$/.test(text) ? Number(text) : undefined;

const registerBooleanCommand = ({ name, key, description }: typeof BOOLEAN_COMMANDS[number]): void => {
    Instance.RegisterCheatCommand(name, (args) => {
        const configuration = getConfiguration();
        const value = parseArgument(name, args).toLowerCase();
        if (value.length === 0) {
            Instance.Msg(`${name} = ${configuration[key] ? 1 : 0} (${description}). Usage: ${name} <0|1>`);
            return;
        }
        if (!TRUE_VALUES.has(value) && !FALSE_VALUES.has(value)) {
            Instance.Msg(`${name}: invalid value "${value}". Usage: ${name} <0|1>`);
            return;
        }
        configuration[key] = TRUE_VALUES.has(value);
        renderRules();
        Instance.Msg(`${name} = ${configuration[key] ? 1 : 0}`);
    });
};

const registerChanceCommand = ({ name, key, description }: typeof CHANCE_COMMANDS[number]): void => {
    Instance.RegisterCheatCommand(name, (args) => {
        const configuration = getConfiguration();
        const text = parseArgument(name, args);
        if (text.length === 0) {
            Instance.Msg(`${name} = ${Math.round(configuration[key] * 100)} (${description}, in percent). Usage: ${name} <0-100>`);
            return;
        }
        const percent = parseNumber(text);
        if (percent === undefined || percent < 0 || percent > 100) {
            Instance.Msg(`${name}: invalid value "${text}". Usage: ${name} <0-100>`);
            return;
        }
        configuration[key] = percent / 100;
        renderRules();
        Instance.Msg(`${name} = ${percent}`);
    });
};

const registerHealthCommand = (): void => {
    Instance.RegisterCheatCommand(HEALTH_COMMAND, (args) => {
        const configuration = getConfiguration();
        const text = parseArgument(HEALTH_COMMAND, args);
        if (text.length === 0) {
            Instance.Msg(`${HEALTH_COMMAND} = ${configuration.playerHealth} (Player health). Usage: ${HEALTH_COMMAND} <health>`);
            return;
        }
        const health = parseNumber(text);
        if (health === undefined || !Number.isInteger(health) || health < 1) {
            Instance.Msg(`${HEALTH_COMMAND}: invalid value "${text}" - must be a whole number of at least 1. Usage: ${HEALTH_COMMAND} <health>`);
            return;
        }
        configuration.playerHealth = health;
        // renderRules() also applies the new health to everyone's pawn.
        renderRules();
        Instance.Msg(`${HEALTH_COMMAND} = ${health}`);
    });
};

// Registered from index.ts.
export const registerCommands = (): void => {
    BOOLEAN_COMMANDS.forEach(registerBooleanCommand);
    CHANCE_COMMANDS.forEach(registerChanceCommand);
    registerHealthCommand();
};
