import { CSPlayerController, Instance, Entity, type Vector } from "cs_script/point_script";
import { persistOnReload } from "../shared/persist";
import { setEntityMessage } from "../shared/ui";
import { getPlayers, refreshPlayers, setGameHasStarted } from "../shared/gamestate";
import { CT_TEAM, T_TEAM } from "../shared/teams";
import { forceSpawnTemplate } from "../shared/spawn";
import * as timers from "../shared/timers";

const buttonOffset = 25;
const playerButtonNamePrefix = "test_player_button_";
const playerButtonTextNamePrefix = "test_player_button_text_";

interface Player {
    id: number;
    isBot: boolean;
    name: string;
    currentTeam: number;
    teamToJoinWhenGameStart: number;
    playerButton: PlayerButton;
    playerController: CSPlayerController;
}

interface PlayerButton {
    buttonName: string;
    buttonTextName: string;
}

interface Configuration {
    players: Player[];
}

let configuration: Configuration = {
    players: [],
};

const findById = (id: number): Player | undefined => configuration.players.find((player) => player.id === id);
const findByButtonName = (button: string): Player | undefined => configuration.players.find((player) => player.playerButton.buttonName === button);

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
            playerButton: createPlayerButton({ position: { x: -15792, y: -14912, z: -15759 }, id: id.toString() }),
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

    const [removed] = configuration.players.splice(index, 1);
    killPlayerButton(removed.playerButton);
};

const updateUi = (): void => {
    const ctAnchor = Instance.FindEntityByName("ct_players");
    const tAnchor = Instance.FindEntityByName("t_players");

    if (!ctAnchor || !tAnchor) {
        Instance.Msg("Cannot find ct or t anchors");
        return;
    }

    let tOffset = 0;
    let ctOffset = 0;

    for (let i = 0; i < configuration.players.length; i++) {
        const player = configuration.players[i];
        const playerButton = Instance.FindEntityByName(player.playerButton.buttonName);
        const playerButtonText = Instance.FindEntityByName(player.playerButton.buttonTextName);
        if (!playerButton || !playerButtonText) {
            Instance.Msg(`Cannot find button or button text for player ${player.playerButton.buttonName}`);
            createPlayerButton({ position: { x: -0, y: -0, z: -0 }, id: player.id.toString() }); //If button for is missing (for some reason my own player never gets a button), recreate and re render UI next think
            timers.setTimeout(updateUi, 0);
            continue;
        }

        const anchor: Entity = (player.teamToJoinWhenGameStart === CT_TEAM ? ctAnchor : tAnchor)!;
        if (anchor === tAnchor) {
            tOffset -= buttonOffset;
        } else {
            ctOffset -= buttonOffset;
        }
        const base = anchor.GetAbsOrigin();
        playerButton.Teleport({
            position: {
                x: base.x,
                y: base.y,
                z: base.z + (anchor === ctAnchor ? ctOffset : tOffset),
            }
        });

        const namePrefix = player.isBot ? "BOT " : "";

        playerButtonText.Teleport({
            position: {
                x: base.x,
                y: base.y,
                z: base.z + (anchor === ctAnchor ? ctOffset : tOffset),
            }
        });

        setEntityMessage(playerButtonText, `${namePrefix}${player.name}`);
    }
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

Instance.OnPlayerConnect((event) => {
    const playerController = event?.player;
    if (!playerController?.IsValid?.()) {
        return;
    }

    upsertFromController(playerController);
    timers.setTimeout(updateUi, 0);
});

export const onRoundStart = () => {
    timers.setTimeout(() => {
        syncPlayersFromGameState();
        timers.setTimeout(updateUi, 0);
    }, 0);
};

Instance.OnPlayerActivate((event) => {
    const playerController = event?.player;
    if (!playerController?.IsValid?.()) {
        return;
    }

    upsertFromController(playerController);
    timers.setTimeout(updateUi, 0);
});

Instance.OnPlayerDisconnect((event) => {
    if (typeof event?.playerSlot !== "number") {
        return;
    }

    removeById(event.playerSlot);
    timers.setTimeout(updateUi, 0);
});

const syncPlayersFromGameState = (): void => {
    refreshPlayers();
    for (const controller of getPlayers()) {
        upsertFromController(controller);
    }
};

export const onActivate = () => {
    timers.setTimeout(() => {
        syncPlayersFromGameState();
        timers.setTimeout(updateUi, 0);
    }, 0);
};

Instance.OnScriptInput("TogglePlayerTeam", (event) => {
    const buttonEntity = event.caller;
    if (!buttonEntity) {
        Instance.Msg(`Cannot identify button entity from caller`);
        return;
    }

    const player = findByButtonName(buttonEntity.GetEntityName());
    if (!player) {
        Instance.Msg(`Cannot find player associated with button entity`);
        return;
    }

    player.teamToJoinWhenGameStart = player.teamToJoinWhenGameStart === CT_TEAM ? T_TEAM : CT_TEAM;
    killPlayerButton(player.playerButton); //Moving buttons that have been pressed results in a button that slowly slides away for some reason so we just destroy and recreate it.
    timers.setTimeout(() => {
        player.playerButton = createPlayerButton({ position: { x: -0, y: -0, z: -0 }, id: player.id.toString() });
        timers.setTimeout(updateUi, 0);
    }, 0);
});

export const onStartGame = () => {
    updatePlayerTeams();
};

persistOnReload("teamconfiguration", {
    configuration: { get: () => configuration, set: (value) => { configuration = value; } },
}, () => {
    syncPlayersFromGameState();
    timers.setTimeout(updateUi, 0);
});

const killPlayerButton = (playerButton: PlayerButton) => {
    Instance.EntFireAtName({
        name: playerButton.buttonName,
        input: "kill",
    });
    Instance.EntFireAtName({
        name: playerButton.buttonTextName,
        input: "kill",
    });
};

// Always returns valid (deterministic) names, even if the actual spawn below fails - updateUi()
// already retries FindEntityByName every think until a button by that name actually exists, so
// there's no need for a null/PlayerButton|null result here.
const createPlayerButton = (data: { position: Vector, id: string }): PlayerButton => {
    const buttonName = playerButtonNamePrefix + data.id;
    const buttonTextName = playerButtonTextNamePrefix + data.id;

    const spawned = forceSpawnTemplate("player_button_point_template", data.position);
    if (spawned && spawned.length >= 2) {
        const [button, buttonText] = spawned;

        button.Teleport({ position: data.position });
        buttonText.Teleport({ position: data.position });

        setEntityMessage(buttonText, "New text");
        button.SetEntityName(buttonName);
        buttonText.SetEntityName(buttonTextName);
    }

    return { buttonName, buttonTextName };
};
