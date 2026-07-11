import { Entity, Instance, PointTemplate, type Vector } from "cs_script/point_script";
import { persistOnReload } from "../shared/persist";
import * as timers from "../shared/timers";

// mp_shoot_dropped_grenades can't be set via ServerCommand (not whitelisted), so instead we spawn a
// dropped grenade inside test_mp_shoot_dropped_grenades_target, a trigger_hurt in the map. If the cvar
// is actually enabled, the trigger's damage detonates the grenade, which presses a button in the map
// wired to fire RunScriptInput with parameter test_shoot_grenades_enabled back into this script.
const TARGET_ENTITY_NAME = "test_mp_shoot_dropped_grenades_target";
const GRENADE_TEMPLATE_NAME = "he_action_point_template";
const CHECK_INTERVAL_SECONDS = 0.25; // 4 times per second
const WARNING_MESSAGE = "mp_shoot_dropped_grenades is NOT enabled - dropped grenades will not detonate when shot!";

var confirmedEnabled = false;

// No PrintToChat API exists; issuing "say" via one connected player's own ClientCommand broadcasts
// the message into everyone's chat the same way a real chat message would.
const printToChat = (message: string) => {
    const maxSlots = 100;
    for (let slot = 0; slot < maxSlots; slot++) {
        const controller = Instance.GetPlayerController(slot);
        if (controller && controller.IsValid() && controller.IsConnected()) {
            Instance.ClientCommand(slot, `say ${message}`);
            return;
        }
    }
};

const spawnTestGrenade = (position: Vector) => {
    const template = Instance.FindEntityByName(GRENADE_TEMPLATE_NAME);
    if (!template) {
        Instance.Msg(`${GRENADE_TEMPLATE_NAME} not found`);
        return;
    }
    if (!(template instanceof PointTemplate)) {
        Instance.Msg(`${GRENADE_TEMPLATE_NAME} is not of type point template`);
        return;
    }

    const spawned = template.ForceSpawn(position);
    if (!spawned || spawned.length === 0) {
        Instance.Msg(`Failed to spawn ${GRENADE_TEMPLATE_NAME}`);
        return;
    }

    const entity = spawned[0];
    entity.Teleport({ position });
    Instance.EntFireAtTarget({ target: entity, input: "InitializeSpawnFromWorld", delay: 0 });
    return entity;
};

const runCheck = () => {
    if (confirmedEnabled) return;

    const target = Instance.FindEntityByName(TARGET_ENTITY_NAME);
    let grenadeEntity : Entity | undefined = undefined;
    if (!target) {
        Instance.Msg(`${TARGET_ENTITY_NAME} not found`);
    } else {
        grenadeEntity = spawnTestGrenade(target.GetAbsOrigin());
    }

    printToChat(WARNING_MESSAGE);

    if (grenadeEntity) {
            Instance.EntFireAtTarget({ target: grenadeEntity, input: "Kill", delay: 0.25 });
    }
    timers.setTimeout(runCheck, CHECK_INTERVAL_SECONDS);
};

Instance.OnScriptInput("test_shoot_grenades_enabled", () => {
    confirmedEnabled = true;
    Instance.Msg("Confirmed: mp_shoot_dropped_grenades is enabled");
});

persistOnReload("test_mp_shoot_dropped_grenades", {
    confirmedEnabled: { get: () => confirmedEnabled, set: (value) => { confirmedEnabled = value; } },
}, () => {
    confirmedEnabled = false;
    runCheck();
});

export function onRoundStart() {
    confirmedEnabled = false;
    runCheck();
}

