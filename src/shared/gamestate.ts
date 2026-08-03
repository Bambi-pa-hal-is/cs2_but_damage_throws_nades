import { CSGearSlot, Instance, type CSPlayerController, type CSPlayerPawn } from "cs_script/point_script";
import { persistOnReload } from "./persist";
import { CT_TEAM, T_TEAM } from "./teams";

let gameHasStarted = false;

export const CONFIGURATION_SPAWN_NAME = "configuration_spawn";

// info_player_counterterrorist has no Enable/Disable input, only toggleenabled, and every spawn
// starts enabled by default. Toggling isn't idempotent, so we track the current enabled state
// ourselves and only fire the toggle when it actually needs to flip. Terrorist spawns are
// deliberately never toggled - see forceRealPlayersOffT()/OnPlayerReset below for why.
let configurationSpawnsEnabled = true;

let players: CSPlayerController[] = [];

export const getPlayers = (): CSPlayerController[] => players;

// Rescans every player slot. Call this before reading getPlayers() when you need an up to date
// list - this also catches players who connected before this script had loaded.
export const refreshPlayers = (): void => {
    players = Instance.GetAllPlayerControllers();
};

const setConfigurationSpawnsEnabled = (enabled: boolean) => {
    if (enabled === configurationSpawnsEnabled) return;
    configurationSpawnsEnabled = enabled;

    Instance.EntFireAtName({ name: CONFIGURATION_SPAWN_NAME, input: "toggleenabled" });
};

const forceRealPlayersOffT = () => {
    for (const controller of players) {
        if (controller.IsValid() && !controller.IsBot() && controller.GetTeamNumber() === T_TEAM) {
            controller.JoinTeam(CT_TEAM);
        }
    }
};

// DestroyWeapons() alone leaves the knife behind - it has to be found by slot and destroyed
// separately.
const destroyAllWeapons = (pawn: CSPlayerPawn) => {
    pawn.DestroyWeapons();

    const knife = pawn.FindWeaponBySlot(CSGearSlot.KNIFE);
    if (knife) pawn.DestroyWeapon(knife);
};

// Before the match starts, the only weapon on the map should be the single shared
// configuration_ak - real weapons would let everyone independently arm/configure instead of
// having to share the one pickup.
const stripAllWeapons = () => {
    for (const controller of players) {
        const pawn = controller.GetPlayerPawn();
        if (pawn) destroyAllWeapons(pawn);
    }
};

// forceRealPlayersOffT() above only runs when applyGameState() is called (e.g. round start) - a
// player who spawns as T in between (say, via a manual jointeam) wouldn't be caught until the next
// one. This catches it immediately on the actual spawn/respawn instead.
export const onPlayerReset = (event: { player: CSPlayerPawn }) => {
    if (gameHasStarted) return;

    destroyAllWeapons(event.player);

    if (event.player.GetTeamNumber() !== T_TEAM) return;

    const controller = event.player.GetPlayerController();
    if (!controller || controller.IsBot()) return;

    controller.JoinTeam(CT_TEAM);
};

// Applies the spawn/team setup for the current gameHasStarted value. Safe to call repeatedly
// (e.g. every round start) to catch late joiners or manual team switches.
export const applyGameState = (): void => {
    setConfigurationSpawnsEnabled(!gameHasStarted);

    if (!gameHasStarted) {
        refreshPlayers();
        forceRealPlayersOffT();
        stripAllWeapons();
    }
};

export const getGameHasStarted = (): boolean => gameHasStarted;

export const setGameHasStarted = (value: boolean): void => {
    gameHasStarted = value;
    applyGameState();
};

persistOnReload("gamestate", {
    gameHasStarted: { get: () => gameHasStarted, set: (value) => { gameHasStarted = value; } },
    configurationSpawnsEnabled: { get: () => configurationSpawnsEnabled, set: (value) => { configurationSpawnsEnabled = value; } },
    players: { get: () => players, set: (value) => { players = value; } },
}, () => {
    // Values are already restored by the time this runs, so this is a no-op unless something is
    // actually out of sync - safe to call, not a resend/inversion of the toggle.
    applyGameState();
});
