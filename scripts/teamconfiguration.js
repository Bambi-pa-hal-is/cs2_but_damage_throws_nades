import { BaseModelEntity, CSPlayerController, Instance, PointTemplate } from "cs_script/point_script";


const playerButtonPrefix = "player_button_";
const playerNamePrefix = "player_name_";

/**
 * @typedef {Object} Player
 * @property {number} id
 * @property {boolean} isBot
 * @property {string} name
 * @property {number} currentTeam
 * @property {number} teamToJoinWhenGameStart
 */

/**
 * @typedef {Object} Configuration
 * @property {Player[]} players
 * @property {boolean} gameHasStarted
 */

/** @type {Configuration} */
var configuration = {
  players: [],
  gameHasStarted: false
};

/**
 * helper: remove by slot
 * @param {number} id
 */
function findById(id) {
    return configuration.players.find(function (p) { return p.id === id; });
}

/** helper: add or update from a controller */
/**
 * helper: remove by slot
 * @param {CSPlayerController} pc
 */
function upsertFromController(pc) {
    var id = pc.GetPlayerSlot();
    var isBot = pc.IsBot();
    var name = pc.GetPlayerName();
    var team = pc.GetTeamNumber();

    var p = findById(id);
    if (!p) {
        p = {
            id: id,
            isBot: isBot,
            name: name,
            currentTeam: team,
            teamToJoinWhenGameStart: configuration.players.length % 2 == 0 ? 3 : 2,
        };
        configuration.players.push(p);
        Instance.Msg("Player added: " + name + " (id=" + id + ", bot=" + isBot + ", team=" + team + ")");
    } else {
        p.isBot = isBot;
        p.name = name;
        p.currentTeam = team;
    }

    return p;
}

/**
 * helper: remove by slot
 * @param {number} id
 */
function removeById(id) {
    for (var i = 0; i < configuration.players.length; i++) {
        if (configuration.players[i].id === id) {
            var gone = configuration.players[i];
            configuration.players.splice(i, 1);
            Instance.Msg("Player removed: " + gone.name + " (id=" + id + ")");
            return;
        }
    }
}

/** Event wiring **/

// Fires when a client (human or bot) takes a slot.
Instance.OnPlayerConnect(function (event) {
    if (!event || !event.player.IsValid()) return;
    upsertFromController(event.player);
    updateUi();
});

Instance.OnRoundStart(() => {
    updateUi();
});

// Fires when the pawn/controller is fully active (after connect).
Instance.OnPlayerActivate(function (event) {
    if (!event || !event.player.IsValid()) return;
    upsertFromController(event.player);
    updateUi();
});

// Fires when a slot is vacated.
Instance.OnPlayerDisconnect(function (event) {
    removeById(event.playerSlot);
    updateUi();
});

//Init
Instance.OnActivate(() =>
{
    var numberOfIterations = 100;
    var playerEntities = Instance.FindEntitiesByClass("player");
    for(var i=0;i<100;i++)
    {
        var playerController = Instance.GetPlayerController(i);
        if(playerController && playerController.IsValid())
        {
            upsertFromController(playerController);
        }
    }
    updateUi();
});

function updateUi()
{
    const anchors = {
        ct: Instance.FindEntityByName("ct_players"),
        t:  Instance.FindEntityByName("t_players"),
    };
    if (!anchors.ct || !anchors.t)
    {
        Instance.Msg("Cannot find ct or t anchors");
        return;
    }
    var tOffset = 0;
    var ctOffset = 0;

    const maxPlayers = 16;
    for(var i=0;i<maxPlayers;i++)
    {
        var player = configuration.players[i];
        if(player)
        {
            var anchor = player.teamToJoinWhenGameStart == 3 ? anchors.ct : anchors.t;
            tOffset += (anchor == anchors.t ? -25 : 0);
            ctOffset += (anchor == anchors.ct ? -25 : 0);
            var zOffset = anchor == anchors.ct ? ctOffset : tOffset;

            const base = anchor.GetAbsOrigin();
            const pos = {
                x: base.x ,
                y: base.y ,
                z: base.z + zOffset
            };

            var namePrefix = player.isBot ? "BOT " : "";

            var playerButton = Instance.FindEntityByName(playerButtonPrefix + i);
            if(!playerButton)
            {
                Instance.Msg("Cannot find " + playerButtonPrefix + i);
                continue;
            }
            playerButton.Teleport({
                position: pos,
                angles:undefined,
                velocity:undefined,
            });
            Instance.EntFireAtName({
                name: playerNamePrefix + i,
                input: "setmessage",
                value: namePrefix + player.name,
                delay: 0
            });
        }
        else{
            Instance.Msg("Updating for empty" + i);
            var emptyAnchor = Instance.FindEntityByName("player_button_idle_position");
            var playerButton = Instance.FindEntityByName(playerButtonPrefix + i);
            if(!playerButton)
            {
                Instance.Msg("Cannot find " + playerButtonPrefix + i);
                continue;
            }

            if(!emptyAnchor)
            {
                Instance.Msg("Cannot find player_button_idle_position");
                continue;
            }

            const base = emptyAnchor.GetAbsOrigin();
            const pos = {
                x: base.x ,
                y: base.y ,
                z: base.z + i * -25
            };
            playerButton.Teleport({
                position: pos,
                angles:undefined,
                velocity:undefined,
            });

            Instance.EntFireAtName({
                name: playerNamePrefix + i,
                input: "setmessage",
                value: "Empty",
                delay: 0
            });
        }
    }
}

Instance.OnScriptInput("TogglePlayerTeam", (caller) => {
    Instance.Msg(caller?.caller?.GetEntityName());
    caller?.caller?.SetHealth(1000);
    var buttonName = caller?.caller?.GetEntityName();
    if(buttonName)
    {
        var id = +buttonName.replaceAll(playerButtonPrefix,"");
        var player = configuration.players[id];
        if(player)
        {
            player.teamToJoinWhenGameStart = player.teamToJoinWhenGameStart == 3 ? 2 : 3;
            updateUi();
        }
    }
});

Instance.OnScriptInput("StartGame", (caller) => {
    configuration.gameHasStarted = true;
    updatePlayerTeams();
});

const updatePlayerTeams = () => {
    // Move every tracked player to their configured team for game start.
    for (var i = 0; i < configuration.players.length; i++) {
        var p = configuration.players[i];
        if (!p) continue;

        var desiredTeam = p.teamToJoinWhenGameStart;
        var pc = Instance.GetPlayerController(p.id);

        if (pc && pc.IsValid && pc.IsValid()) {
            try {
                // Instruct the controller to join the desired team and update local state.
                pc.JoinTeam(desiredTeam);
                p.currentTeam = desiredTeam;
                Instance.Msg("Moved player: " + p.name + " (id=" + p.id + ") to team " + desiredTeam);
            }
            catch (e) {
                Instance.Msg("Failed to move player id=" + p.id + " : " + e);
            }
        } else {
            Instance.Msg("No valid controller found for player id=" + p.id + ", skipping team change.");
        }
    }
}

Instance.OnScriptReload({
    before: () => {
        return { configuration };
    },
    after: (memory) => {
        if (memory && memory.configuration !== undefined) {
            configuration = memory.configuration;
        }
    },
});


Instance.OnGrenadeThrow((event)=> {
    var owner = event.weapon.GetOwner();
    if(!owner)
    {
        Instance.Msg("Grenade thrown by invalid owner");
        return;
    }
    const template = Instance.FindEntityByName("player_button_point_template");
    if (!template) {
        Instance.Msg("player_button_point_template not found");
        return;
    }
    if(!(template instanceof PointTemplate))
    {
        Instance.Msg("player_button_point_template is not of type point template");
        return;
    }

    const eyePos = owner.GetEyePosition();
    const eyeAng = owner.GetEyeAngles();

    const spawned = template.ForceSpawn(eyePos,eyeAng);
    if (!spawned || spawned.length === 0) return;

    const button = spawned[0]; 
    const buttonText = spawned[1]; 

    button.Teleport({
        position: eyePos,
    });
    buttonText.Teleport({
        position: eyePos,
    });
    Instance.EntFireAtTarget({ 
        target: buttonText,
        input: "setmessage",
        value: "New text",
        activator: owner,
        caller: owner,
        delay: 0
    });
});