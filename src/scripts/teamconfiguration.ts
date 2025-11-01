import { CSPlayerController, Instance, Entity, type Vector, PointTemplate } from "cs_script/point_script";

const ctTeam = 3;
const tTeam = 2;
const buttonOffset = 25;

interface Player {
	id: number;
	isBot: boolean;
	name: string;
	currentTeam: number;
	teamToJoinWhenGameStart: number;
    playerButton: PlayerButton;
	playerController: CSPlayerController | null;
}

interface PlayerButton {
	entity: Entity;
	text: Entity;
}

interface Configuration {
	players: Player[];
	gameHasStarted: boolean;
}

let configuration: Configuration = {
	players: [],
	gameHasStarted: false,
};

const findById = (id: number): Player | undefined => configuration.players.find((player) => player.id === id);
const findByButtonEntity = (button: Entity): Player | undefined => configuration.players.find((player) => player.playerButton.entity === button);

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
            playerButton: createPlayerButton({position: {x:0, y:0, z:0}})!,
		};
		configuration.players.push(player);
		Instance.Msg(`Player added: ${name} (id=${id}, bot=${isBot}, team=${team})`);
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

	for (let i = 0; i < configuration.players.length; i += 1) {
		const player = configuration.players[i];
		const playerButton = player.playerButton.entity;
		const playerButtonText = player.playerButton.text;

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
		const controller = Instance.GetPlayerController(player.id);

		if (!controller?.IsValid?.()) {
			Instance.Msg(`No valid controller found for player id=${player.id}, skipping team change.`);
			continue;
		}

		try {
			controller.JoinTeam(desiredTeam);
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
	updateUi();
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
	updateUi();
});

Instance.OnPlayerDisconnect((event) => {
	if (typeof event?.playerSlot !== "number") {
		return;
	}

	removeById(event.playerSlot);
	updateUi();
});

Instance.OnActivate(() => {
	const maxSlots = 100;
	for (let slot = 0; slot < maxSlots; slot += 1) {
		const controller = Instance.GetPlayerController(slot);
		if (controller?.IsValid?.()) {
			upsertFromController(controller);
		}
	}

	updateUi();
});

Instance.OnScriptInput("TogglePlayerTeam", (event) => {
	const buttonEntity = event.caller;
	if (!buttonEntity) {
		Instance.Msg(`Cannot identify button entity from caller`);
		return;
	}

	let player = findByButtonEntity(buttonEntity!);
	if (!player) {
		Instance.Msg(`Cannot find player associated with button entity`);
		return;
	}

	player.teamToJoinWhenGameStart = player.teamToJoinWhenGameStart === ctTeam ? tTeam : ctTeam;
	killPlayerButton(player.playerButton);
	var newPlayerButton = createPlayerButton({position: buttonEntity.GetAbsOrigin()});
	if (newPlayerButton) {
		player.playerButton = newPlayerButton;
	}
	updateUi();
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
	Instance.EntFireAtTarget({
		target: playerButton.entity,
		input: "kill",
	});
	Instance.EntFireAtTarget({
		target: playerButton.text,
		input: "kill",
	});
};

const createPlayerButton = (data: {position: Vector}): PlayerButton | null => {

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
        angles: undefined,
        velocity: undefined,
    });

    buttonText.Teleport({
        position: data.position,
        angles: undefined,
        velocity: undefined,
    });

    Instance.EntFireAtTarget({
        target: buttonText,
        input: "setmessage",
        value: "New text",
        delay: 0,
    });
    return {entity: button, text: buttonText};
};

Instance.OnGrenadeThrow((event) => {
	// const owner = event.weapon.GetOwner();
	// if (!owner) {
	// 	Instance.Msg("Grenade thrown by invalid owner");
	// 	return;
	// }

	// const template = Instance.FindEntityByName("player_button_point_template");
	// if (!template) {
	// 	Instance.Msg("player_button_point_template not found");
	// 	return;
	// }

	// if (!(template instanceof PointTemplate)) {
	// 	Instance.Msg("player_button_point_template is not of type point template");
	// 	return;
	// }

	// const eyePos = owner.GetEyePosition();
	// const eyeAng = owner.GetEyeAngles();

	// const spawned = template.ForceSpawn(eyePos, eyeAng);
	// if (!spawned || spawned.length < 2) {
	// 	return;
	// }

	// const [button, buttonText] = spawned;

	// button.Teleport({
	// 	position: eyePos,
	// 	angles: undefined,
	// 	velocity: undefined,
	// });

	// buttonText.Teleport({
	// 	position: eyePos,
	// 	angles: undefined,
	// 	velocity: undefined,
	// });

	// Instance.EntFireAtTarget({
	// 	target: buttonText,
	// 	input: "setmessage",
	// 	value: "New text",
	// 	activator: owner,
	// 	caller: owner,
	// 	delay: 0,
	// });
});
