import { CSPlayerController, Instance } from "cs_script/point_script";
import { persistOnReload } from "../shared/persist";
import { isLobbyMap } from "../shared/gamestate";

// Flip to true to test the dedicated-server flow (everyone votes on the map, default rules) from
// inside a listen server. but_set_host still overrides it, same as on a real dedicated server.
export const SIMULATE_DEDICATED_SERVER = false;

// On a listen server the host always occupies player slot 0.
const LISTEN_SERVER_HOST_SLOT = 0;

const SET_HOST_COMMAND = "but_set_host";

// Set by but_set_host - takes priority over both the listen server host and vote mode. Cleared
// again if that player disconnects.
let hostSlotOverride: number | undefined;

// The slot of the one player allowed to configure the match, or undefined when nobody is (vote
// mode - every player votes on the map and the default rules are used).
export const getHostSlot = (): number | undefined => {
    if (hostSlotOverride !== undefined) return hostSlotOverride;
    if (Instance.IsDedicatedServer() || SIMULATE_DEDICATED_SERVER) return undefined;
    return LISTEN_SERVER_HOST_SLOT;
};

export const isVoteMode = (): boolean => getHostSlot() === undefined;

// Running directly on a real map with nobody hosting: there's no map to vote on, so there's no
// menu at all - the match just runs with the default rules.
export const isMenuSkipped = (): boolean => !isLobbyMap() && isVoteMode();

const getConnectedHumans = (): CSPlayerController[] =>
    Instance.GetAllPlayerControllers().filter((controller) => controller.IsValid() && controller.IsConnected() && !controller.IsBot());

// The callback may or may not get the command name itself in front of the arguments - strip it if
// it's there, along with any quotes around the name.
const parsePlayerName = (args: string): string => {
    let text = (args ?? "").trim();
    if (text.toLowerCase() === SET_HOST_COMMAND || text.toLowerCase().startsWith(SET_HOST_COMMAND + " ")) {
        text = text.substring(SET_HOST_COMMAND.length).trim();
    }
    if (text.length >= 2 && text.startsWith("\"") && text.endsWith("\"")) {
        text = text.substring(1, text.length - 1).trim();
    }
    return text;
};

// Exact (case-insensitive) name match wins, otherwise falls back to a partial match so long names
// don't have to be typed out in full.
const findPlayersByName = (name: string): CSPlayerController[] => {
    const needle = name.toLowerCase();
    const players = getConnectedHumans();
    const exact = players.filter((controller) => controller.GetPlayerName().toLowerCase() === needle);
    if (exact.length > 0) return exact;
    return players.filter((controller) => controller.GetPlayerName().toLowerCase().includes(needle));
};

const listPlayerNames = (players: CSPlayerController[]): string =>
    players.map((controller) => `"${controller.GetPlayerName()}"`).join(", ") || "(none)";

// Registered from index.ts. `onHostChanged` lets mainMenu.ts re-render for the new mode without
// this module having to import it.
export const registerCommands = (onHostChanged: () => void): void => {
    Instance.RegisterCheatCommand(SET_HOST_COMMAND, (args) => {
        const name = parsePlayerName(args);
        if (name.length === 0) {
            Instance.Msg(`${SET_HOST_COMMAND}: missing player name. Usage: ${SET_HOST_COMMAND} <player name>`);
            Instance.Msg(`${SET_HOST_COMMAND}: players: ${listPlayerNames(getConnectedHumans())}`);
            return;
        }

        const matches = findPlayersByName(name);
        if (matches.length === 0) {
            Instance.Msg(`${SET_HOST_COMMAND}: no player named "${name}". Players: ${listPlayerNames(getConnectedHumans())}`);
            return;
        }
        if (matches.length > 1) {
            Instance.Msg(`${SET_HOST_COMMAND}: "${name}" matches more than one player: ${listPlayerNames(matches)}`);
            return;
        }

        const player = matches[0];
        hostSlotOverride = player.GetPlayerSlot();
        Instance.Msg(`${SET_HOST_COMMAND}: "${player.GetPlayerName()}" now controls the match setup menu`);
        onHostChanged();
    });
};

// Returns true if the disconnecting player was the but_set_host host, i.e. the control mode just
// changed back to the default.
export const onPlayerDisconnect = (event: { playerSlot: number }): boolean => {
    if (hostSlotOverride === undefined || event.playerSlot !== hostSlotOverride) return false;
    hostSlotOverride = undefined;
    Instance.Msg(`${SET_HOST_COMMAND}: host disconnected - menu control is back to the default`);
    return true;
};

persistOnReload("hostControl", {
    hostSlotOverride: { get: () => hostSlotOverride, set: (value) => { hostSlotOverride = value; } },
});
