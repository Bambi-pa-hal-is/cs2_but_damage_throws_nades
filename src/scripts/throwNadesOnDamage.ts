import { CSGrenadeProjectileBase, CSGrenadeType, CSPlayerPawn, Instance } from "cs_script/point_script";
import { persistOnReload } from "../shared/persist";
import { getGameHasStarted } from "../shared/gamestate";

export type NadeType = "he" | "flashbang" | "smoke" | "molotov" | "decoy";

export interface ThrowNadesConfiguration {
    throwGrenadeWhenShooting: boolean;
    chanceToThrowGrenadeWhenShooting: number;
    throwGrenadeWhenDealingDamage: boolean;
    chanceToThrowGrenadeWhenDealingDamage: number;
    isHeAllowed: boolean;
    isFlashbangAllowed: boolean;
    isSmokeAllowed: boolean;
    isMolotovAllowed: boolean;
    isDecoyAllowed: boolean;
    onlyEquippedNades: boolean;
    playerHealth: number;
}

let configuration: ThrowNadesConfiguration = {
    throwGrenadeWhenShooting: false,
    chanceToThrowGrenadeWhenShooting: 1.0,
    throwGrenadeWhenDealingDamage: true,
    chanceToThrowGrenadeWhenDealingDamage: 1.0,
    isHeAllowed: true,
    isFlashbangAllowed: false,
    isSmokeAllowed: true,
    isMolotovAllowed: true,
    isDecoyAllowed: false,
    onlyEquippedNades: false,
    playerHealth: 300,
};

// The UI module reads/writes fields on this directly - it's the single shared source of truth.
export const getConfiguration = (): ThrowNadesConfiguration => configuration;

const grenadeTypeByNadeType: Record<NadeType, CSGrenadeType> = {
    he: CSGrenadeType.HE,
    flashbang: CSGrenadeType.FLASHBANG,
    smoke: CSGrenadeType.SMOKE,
    molotov: CSGrenadeType.MOLOTOV,
    decoy: CSGrenadeType.DECOY,
};

// Used to detect which grenades a player actually has equipped (for onlyEquippedNades) and, for the
// molotov family specifically, whether they're carrying a real molotov or an incendiary.
const weaponNamesByNadeType: Record<NadeType, string[]> = {
    he: ["weapon_hegrenade"],
    flashbang: ["weapon_flashbang"],
    smoke: ["weapon_smokegrenade"],
    molotov: ["weapon_molotov", "weapon_incgrenade"],
    decoy: ["weapon_decoy"],
};

const isNadeTypeEquipped = (pawn: CSPlayerPawn, nadeType: NadeType): boolean =>
    weaponNamesByNadeType[nadeType].some((weaponName) => pawn.FindWeapon(weaponName) !== undefined);

const INCENDIARY_WEAPON_NAME = "weapon_incgrenade";

// SpawnGrenadeProjectile treats molotov/incendiary as distinct types, so pick the one that matches
// what the player actually has equipped rather than always spawning a real molotov.
const getGrenadeType = (pawn: CSPlayerPawn, nadeType: NadeType): CSGrenadeType => {
    if (nadeType === "molotov" && pawn.FindWeapon(INCENDIARY_WEAPON_NAME) !== undefined) {
        return CSGrenadeType.INCENDIARY;
    }
    return grenadeTypeByNadeType[nadeType];
};

const throwNadeForPlayer = (pawn: CSPlayerPawn, nadeType: NadeType): CSGrenadeProjectileBase => {
    return Instance.SpawnGrenadeProjectile({
        type: getGrenadeType(pawn, nadeType),
        thrower: pawn,
    });
};

const getRandomAllowedNadeType = (pawn: CSPlayerPawn) : NadeType | null => {
    const allowedNades : NadeType[] = [];

    if (configuration.isHeAllowed) allowedNades.push("he");
    if (configuration.isFlashbangAllowed) allowedNades.push("flashbang");
    if (configuration.isSmokeAllowed) allowedNades.push("smoke");
    if (configuration.isMolotovAllowed) allowedNades.push("molotov");
    if (configuration.isDecoyAllowed) allowedNades.push("decoy");

    const candidates = configuration.onlyEquippedNades
        ? allowedNades.filter((nadeType) => isNadeTypeEquipped(pawn, nadeType))
        : allowedNades;

    if (candidates.length === 0) return null;

    const randomIndex = Math.floor(Math.random() * candidates.length);
    return candidates[randomIndex];
};

// --- main hook ---
Instance.OnGunFire((event) => {
    if (!getGameHasStarted()) return;

    const shooter = event.weapon.GetOwner();
    if (!shooter) return;

    const randomValue = Math.random();
    if(configuration.throwGrenadeWhenShooting && randomValue < configuration.chanceToThrowGrenadeWhenShooting)
    {
        //throw nade
        const nadeType = getRandomAllowedNadeType(shooter);
        if(!nadeType) return;
        throwNadeForPlayer(shooter, nadeType);
    }
});

Instance.OnModifyPlayerDamage((event) => {
    if (!getGameHasStarted()) return;

    const attacker = event.attacker;
    if (!attacker) return;
    if (!(attacker instanceof CSPlayerPawn))
    {
        Instance.Msg("attacker not playercontroller");
        return;
    }
    const randomValue = Math.random();
    if(configuration.throwGrenadeWhenDealingDamage && randomValue < configuration.chanceToThrowGrenadeWhenDealingDamage)
    {
        //throw nade
        const nadeType = getRandomAllowedNadeType(attacker);
        if(!nadeType) return;
        throwNadeForPlayer(attacker, nadeType);
    }
});

persistOnReload("throwNadesOnDamage", {
    configuration: { get: () => configuration, set: (value) => { configuration = value; } },
});
