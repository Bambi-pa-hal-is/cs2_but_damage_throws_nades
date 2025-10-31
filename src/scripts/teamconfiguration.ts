import { BaseModelEntity, CSPlayerController, Instance } from "cs_script/point_script";

const playerButtonPrefix = "player_button_";
const playerNamePrefix = "player_name_";

interface Player {
	id: number;
	isBot: boolean;
	name: string;
	currentTeam: number;
	teamToJoinWhenGameStart: number;
}

interface Configuration {
	players: Player[];
	gameHasStarted: boolean;
}

let configuration: Configuration = {
	players: [],
	gameHasStarted: false,
};

const findById = (id: number): Player | undefined =>
	configuration.players.find((player) => player.id === id);

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
			teamToJoinWhenGameStart: configuration.players.length % 2 === 0 ? 3 : 2,
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

	let idleAnchor;
	let tOffset = 0;
	let ctOffset = 0;

	const maxPlayers = 16;
	for (let index = 0; index < maxPlayers; index += 1) {
		const player = configuration.players[index];
		const playerButton = Instance.FindEntityByName(`${playerButtonPrefix}${index}`);

		if (!playerButton) {
			Instance.Msg(`Cannot find ${playerButtonPrefix}${index}`);
			continue;
		}

		if (player) {
			const anchor: Entity = (player.teamToJoinWhenGameStart === 3 ? ctAnchor : tAnchor)!;
			if (anchor === tAnchor) {
				tOffset -= 25;
			} else {
				ctOffset -= 25;
			}

			const base = anchor.GetAbsOrigin();
			playerButton.Teleport({
				position: {
					x: base.x,
					y: base.y,
					z: base.z + (anchor === ctAnchor ? ctOffset : tOffset),
				},
				angles: undefined,
				velocity: undefined,
			});

			const namePrefix = player.isBot ? "BOT " : "";
			Instance.EntFireAtName({
				name: `${playerNamePrefix}${index}`,
				input: "setmessage",
				value: `${namePrefix}${player.name}`,
				delay: 0,
			});
			continue;
		}

		if (!idleAnchor) {
			idleAnchor = Instance.FindEntityByName("player_button_idle_position");
			if (!idleAnchor) {
				Instance.Msg("Cannot find player_button_idle_position");
				continue;
			}
		}

		Instance.Msg(`Updating for empty${index}`);
		const base = idleAnchor.GetAbsOrigin();
		playerButton.Teleport({
			position: {
				x: base.x,
				y: base.y,
				z: base.z + index * -25,
			},
			angles: undefined,
			velocity: undefined,
		});

		Instance.EntFireAtName({
			name: `${playerNamePrefix}${index}`,
			input: "setmessage",
			value: "Empty",
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
	const buttonEntity = event.caller as (BaseModelEntity & {
		SetHealth?(value: number): void;
	}) | undefined;
	const buttonName = buttonEntity?.GetEntityName();

	if (!buttonName) {
		return;
	}

	buttonEntity?.SetHealth?.(1000);

	const playerIndex = Number(buttonName.replace(playerButtonPrefix, ""));
	if (Number.isNaN(playerIndex)) {
		return;
	}

	const player = configuration.players[playerIndex];
	if (!player) {
		return;
	}

	player.teamToJoinWhenGameStart = player.teamToJoinWhenGameStart === 3 ? 2 : 3;
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
