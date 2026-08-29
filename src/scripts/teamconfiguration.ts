import { CSPlayerController, Instance } from "cs_script/point_script";
import { persistOnReload } from "../shared/persist";
import { getMainMenuLayout } from "../shared/hud";
import { getPlayers, refreshPlayers, getGameHasStarted } from "../shared/gamestate";
import { CT_TEAM, T_TEAM } from "../shared/teams";
import * as timers from "../shared/timers";

// The Teams panel is a fixed-size HUD layout (no dynamic child panels), so only this many players
// per side can get a visible slot. Comfortably above any realistic lobby size for this map.
const MAX_SLOTS_PER_TEAM = 10;

interface Player {
    id: number;
    isBot: boolean;
    name: string;
    currentTeam: number;
    teamToJoinWhenGameStart: number;
    playerController: CSPlayerController;
}

interface Configuration {
    players: Player[];
}

let configuration: Configuration = {
    players: [],
};

// Which player currently occupies each HUD slot - rebuilt every renderHud() call, and used to map
// a clicked "team_slot_ct_<n>" / "team_slot_t_<n>" button id back to a player.
let ctSlotPlayerIds: (number | undefined)[] = new Array(MAX_SLOTS_PER_TEAM).fill(undefined);
let tSlotPlayerIds: (number | undefined)[] = new Array(MAX_SLOTS_PER_TEAM).fill(undefined);

const findById = (id: number): Player | undefined => configuration.players.find((player) => player.id === id);

// Puts real (non-bot) players on CT immediately on connect, before they'd otherwise see CS2's own
// team-select screen - matches the lobby, whose only enabled spawns are CT ones.
const autoAssignToCt = (controller: CSPlayerController): void => {
    if (getGameHasStarted() || controller.IsBot()) return;
    if (controller.GetTeamNumber() !== CT_TEAM) {
        controller.JoinTeam(CT_TEAM);
    }
};

const upsertFromController = (controller: CSPlayerController): Player => {
    const id = controller.GetPlayerSlot();
    const isBot = controller.IsBot();
    const name = controller.GetPlayerName();
    const team = controller.GetTeamNumber();

    const existing = findById(id);
    if (!existing) {
        const player: Player = {
            id,
            isBot,
            name,
            currentTeam: team,
            playerController: controller,
            teamToJoinWhenGameStart: configuration.players.length % 2 === 0 ? CT_TEAM : T_TEAM,
        };
        configuration.players.push(player);
        return player;
    }

    existing.isBot = isBot;
    existing.name = name;
    existing.currentTeam = team;
    return existing;
};

const removeById = (id: number): void => {
    const index = configuration.players.findIndex((player) => player.id === id);
    if (index === -1) {
        return;
    }
    configuration.players.splice(index, 1);
};

const renderColumn = (players: Player[], slotIds: (number | undefined)[], prefix: "ct" | "t"): void => {
    const layout = getMainMenuLayout();
    if (!layout) return;

    for (let i = 0; i < MAX_SLOTS_PER_TEAM; i++) {
        const player = players[i];
        slotIds[i] = player?.id;

        const slotPanelId = `${prefix}_slot_${i}`;
        layout.SetHasClass(slotPanelId, "Empty", !player);
        // A slot that just lost its player still needs its dialog variable cleared - otherwise the
        // stale name lingers (just dimmed via .Empty) instead of disappearing.
        layout.SetDialogVariableString(slotPanelId, "name", player ? (player.isBot ? "BOT " : "") + player.name : "");
    }
};

// Repaints the Teams HUD panel from `configuration`. Safe to call any time - slot assignment is
// recomputed from scratch every time, so it self-heals after connects/disconnects/reorders.
export const renderHud = (): void => {
    const ctPlayers = configuration.players.filter((player) => player.teamToJoinWhenGameStart === CT_TEAM);
    const tPlayers = configuration.players.filter((player) => player.teamToJoinWhenGameStart === T_TEAM);

    renderColumn(ctPlayers, ctSlotPlayerIds, "ct");
    renderColumn(tPlayers, tSlotPlayerIds, "t");
};

// Called by mainMenu.ts when the host (playerController[0]) clicks a slot's move button.
export const handleSlotClick = (team: "ct" | "t", index: number): void => {
    const slotIds = team === "ct" ? ctSlotPlayerIds : tSlotPlayerIds;
    const playerId = slotIds[index];
    if (playerId === undefined) return;

    const player = findById(playerId);
    if (!player) return;

    player.teamToJoinWhenGameStart = player.teamToJoinWhenGameStart === CT_TEAM ? T_TEAM : CT_TEAM;
    renderHud();
};

const updatePlayerTeams = (): void => {
    for (const player of configuration.players) {
        const desiredTeam = player.teamToJoinWhenGameStart;

        if (!player.playerController?.IsValid?.()) {
            Instance.Msg(`No valid controller found for player id=${player.id}, skipping team change.`);
            continue;
        }

        try {
            player.playerController.JoinTeam(desiredTeam);
            player.currentTeam = desiredTeam;
        } catch (error) {
            Instance.Msg(`Failed to move player id=${player.id} : ${error}`);
        }
    }
};

// Exported instead of self-registered - index.ts owns the shared OnPlayerConnect dispatch.
export const onPlayerConnect = (event: { player: CSPlayerController }) => {
    const playerController = event?.player;
    if (!playerController?.IsValid?.()) {
        return;
    }

    autoAssignToCt(playerController);
    upsertFromController(playerController);
    renderHud();
};

export const onRoundStart = () => {
    timers.setTimeout(() => {
        syncPlayersFromGameState();
        renderHud();
    }, 0);
};

// Exported instead of self-registered via Instance.OnPlayerActivate - only one callback can be
// registered per event name, and index.ts already owns the shared OnPlayerActivate dispatch.
export const onPlayerActivate = (event: { player: CSPlayerController }) => {
    const playerController = event?.player;
    if (!playerController?.IsValid?.()) {
        return;
    }

    autoAssignToCt(playerController);
    upsertFromController(playerController);
    renderHud();
};

// Exported instead of self-registered - index.ts owns the shared OnPlayerDisconnect dispatch.
export const onPlayerDisconnect = (event: { playerSlot: number }) => {
    if (typeof event?.playerSlot !== "number") {
        return;
    }

    removeById(event.playerSlot);
    renderHud();
};

const syncPlayersFromGameState = (): void => {
    refreshPlayers();
    for (const controller of getPlayers()) {
        upsertFromController(controller);
    }
};

export const onActivate = () => {
    timers.setTimeout(() => {
        syncPlayersFromGameState();
        renderHud();
    }, 0);
};

export const onStartGame = () => {
    updatePlayerTeams();
};

persistOnReload("teamconfiguration", {
    configuration: { get: () => configuration, set: (value) => { configuration = value; } },
}, () => {
    syncPlayersFromGameState();
    renderHud();
});
