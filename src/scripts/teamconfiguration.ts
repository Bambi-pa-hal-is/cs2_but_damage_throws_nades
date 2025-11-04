import { CSPlayerController, Instance, Entity, type Vector, PointTemplate } from "cs_script/point_script";

const ctTeam = 3;
const tTeam = 2;
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
	gameHasStarted: boolean;
	queuedActions: (() => void)[];
}

let configuration: Configuration = {
	players: [],
	gameHasStarted: false,
	queuedActions: [],
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
			teamToJoinWhenGameStart: configuration.players.length % 2 === 0 ? ctTeam : tTeam,
            playerButton: createPlayerButton({position: {x:-15792, y:-14912, z:-15759}, id: id.toString()})!,
		};
		configuration.players.push(player);
		Instance.Msg(`Player added: ${name} (id=${id}, bot=${isBot}, team=${team})`);
		return player;
	}
	else{
		Instance.Msg(`Player updated: ${name} (id=${id}, bot=${isBot}, team=${team})`);
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
	Instance.Msg(`Player removed: ${removed.name} (id=${id})`);
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

	Instance.Msg(`Updating UI for ${configuration.players.length} players`);

	for (let i = 0; i < configuration.players.length; i++) {
		const player = configuration.players[i];
		const playerButton = Instance.FindEntityByName(player.playerButton.buttonName);
		const playerButtonText = Instance.FindEntityByName(player.playerButton.buttonTextName);
		if (!playerButton || !playerButtonText) {
			Instance.Msg(`Cannot find button or button text for player ${player.playerButton.buttonName}`);
			createPlayerButton({position: {x:-0, y:-0, z:-0}, id: player.id.toString()}); //If button for is missing (for some reason my own player never gets a button), recreate and re render UI next think
			runNextThink(updateUi);
			continue;
		}

		const anchor: Entity = (player.teamToJoinWhenGameStart === ctTeam ? ctAnchor : tAnchor)!;
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

		Instance.EntFireAtTarget({
			target: playerButtonText,
			input: "setmessage",
			value: `${namePrefix}${player.name}`,
			delay: 0,
		});
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
			Instance.Msg(`Moved player: ${player.name} (id=${player.id}) to team ${desiredTeam}`);
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
	runNextThink(updateUi);
});

Instance.OnRoundStart(() => {
	updateUi();
});

Instance.OnPlayerActivate((event) => {
	const playerController = event?.player;
	if (!playerController?.IsValid?.()) {
		return;
	}

	upsertFromController(playerController);
	runNextThink(updateUi);
});

Instance.OnPlayerDisconnect((event) => {
	if (typeof event?.playerSlot !== "number") {
		return;
	}

	removeById(event.playerSlot);
	runNextThink(updateUi);
});

Instance.OnActivate(() => {
	const maxSlots = 100;
	runNextThink(() => {
		for (let slot = 0; slot < maxSlots; slot += 1) 
		{
			const controller = Instance.GetPlayerController(slot);
			if (controller && controller?.IsValid()) {
				upsertFromController(controller);
			}
		}	
		runNextThink(updateUi);
	});
});

Instance.OnScriptInput("TogglePlayerTeam", (event) => {
	const buttonEntity = event.caller;
	if (!buttonEntity) {
		Instance.Msg(`Cannot identify button entity from caller`);
		return;
	}

	let player = findByButtonName(buttonEntity.GetEntityName());
	if (!player) {
		Instance.Msg(`Cannot find player associated with button entity`);
		return;
	}

	player.teamToJoinWhenGameStart = player.teamToJoinWhenGameStart === ctTeam ? tTeam : ctTeam;
	killPlayerButton(player.playerButton); //Moving buttons that have been pressed results in a button that slowly slides away for some reason so we just destroy and recreate it.
	runNextThink(() => {
		var newPlayerButton = createPlayerButton({position: {x:-0, y:-0, z:-0}, id: player.id.toString()});
		if (newPlayerButton) {
			player.playerButton = newPlayerButton;
		}
		runNextThink(updateUi);
	});
});

Instance.OnScriptInput("StartGame", () => {
	configuration.gameHasStarted = true;
	updatePlayerTeams();
});

Instance.OnScriptReload({
	before: () => ({ configuration }),
	after: (memory) => {
		if (memory?.configuration) {
			configuration = memory.configuration;
		}
	},
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

const createPlayerButton = (data: {position: Vector, id:string}): PlayerButton | null => {

    const template = Instance.FindEntityByName("player_button_point_template");
    if (!template) {
        Instance.Msg("player_button_point_template not found");
        return null;
    }

    if (!(template instanceof PointTemplate)) {
        Instance.Msg("player_button_point_template is not of type point template");
        return null;
    }


    const spawned = template.ForceSpawn(data.position);
    if (!spawned || spawned.length < 2) {
        return null;
    }

    const [button, buttonText] = spawned;

    button.Teleport({
        position: data.position,
    });

    buttonText.Teleport({
        position: data.position,
    });
	Instance.Msg("Created player button!!!");
    Instance.EntFireAtTarget({
        target: buttonText,
        input: "setmessage",
        value: "New text",
        delay: 0,
    });
	let buttonName = playerButtonNamePrefix + data.id;
	let buttonTextName = playerButtonTextNamePrefix + data.id;
	button.SetEntityName(buttonName);
	buttonText.SetEntityName(buttonTextName);
    return {buttonName: buttonName, buttonTextName: buttonTextName};
};


const runNextThink = (action: () => void) => {
  configuration.queuedActions.push(action);
}


Instance.SetThink(() => {
  const actions = configuration.queuedActions.splice(0, configuration.queuedActions.length);

  for (let i=0;i!=actions.length;i++) {
      actions[i]();
  }
  Instance.SetNextThink(Instance.GetGameTime());
});
Instance.SetNextThink(Instance.GetGameTime());
