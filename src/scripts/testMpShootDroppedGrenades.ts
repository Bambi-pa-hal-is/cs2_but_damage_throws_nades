import { Entity, Instance, type Vector } from "cs_script/point_script";
import { persistOnReload } from "../shared/persist";
import { getGameHasStarted, getMpShootDroppedGrenadesEnabled, setMpShootDroppedGrenadesEnabled } from "../shared/gamestate";
import { setEntityMessageByName } from "../shared/ui";
import { forceSpawnTemplate } from "../shared/spawn";
import * as timers from "../shared/timers";

// mp_shoot_dropped_grenades can't be set via ServerCommand (not whitelisted), so instead we spawn a
// dropped grenade at the entity test_mp_shoot_dropped_grenades_target. A trigger_hurt tries to destroy it. If the cvar
// is actually enabled, the trigger's damage detonates the grenade, which presses a button in the map
// wired to fire RunScriptInput with parameter test_shoot_grenades_enabled back into this script.
const TARGET_ENTITY_NAME = "test_mp_shoot_dropped_grenades_target";
const GRENADE_TEMPLATE_NAME = "he_action_point_template";
const CHECK_INTERVAL_SECONDS = 0.25; // 4 times per second
const START_BUTTON_DISABLED_MESSAGE = "Before you can start\nHost needs to run this in console\nmp_shoot_dropped_grenades 1\nValve please fix";

const spawnTestGrenade = (position: Vector) => {
    const spawned = forceSpawnTemplate(GRENADE_TEMPLATE_NAME, position);
    if (!spawned) return;

    const entity = spawned[0];
    entity.Teleport({ position });
    Instance.EntFireAtTarget({ target: entity, input: "InitializeSpawnFromWorld", delay: 0 });
    return entity;
};

const runCheck = () => {
    // Once the game has started there's nothing left to verify - stop spawning test grenades and
    // let the loop die instead of rescheduling itself for the rest of the match.
    if (getGameHasStarted() || getMpShootDroppedGrenadesEnabled()) return;

    const target = Instance.FindEntityByName(TARGET_ENTITY_NAME);
    let grenadeEntity: Entity | undefined = undefined;
    if (!target) {
        Instance.Msg(`${TARGET_ENTITY_NAME} not found`);
    } else {
        grenadeEntity = spawnTestGrenade(target.GetAbsOrigin());
    }

    setEntityMessageByName("Start_button_text", START_BUTTON_DISABLED_MESSAGE);

    if (grenadeEntity) {
        Instance.EntFireAtTarget({ target: grenadeEntity, input: "Kill", delay: 0.25 });
    }
    timers.setTimeout(runCheck, CHECK_INTERVAL_SECONDS);
};

Instance.OnScriptInput("test_shoot_grenades_enabled", () => {
    setMpShootDroppedGrenadesEnabled(true);
    setEntityMessageByName("Start_button_text", "Shoot here to start!");
});

persistOnReload("test_mp_shoot_dropped_grenades", {}, () => {
    if (getGameHasStarted()) return;
    setMpShootDroppedGrenadesEnabled(false);
    runCheck();
});

export function onRoundStart() {
    if (getGameHasStarted()) return;
    setMpShootDroppedGrenadesEnabled(false);
    runCheck();
}
