import { BaseModelEntity, Instance } from "cs_script/point_script";
import { getGameHasStarted } from "../shared/gamestate";
import { forceSpawnTemplate } from "../shared/spawn";
import { persistOnReload } from "../shared/persist";

const AK_ENTITY_NAME = "configuration_ak";
const AK_POINT_TEMPLATE_NAME = "configuration_ak_point_template";
const GLOW_COLOR = { r: 0, g: 255, b: 0 };
const AK_SCALE = 2.5;
const YAW_STEP_DEGREES = 3;

const findAk = () => {
    const entity = Instance.FindEntityByName(AK_ENTITY_NAME);
    return entity instanceof BaseModelEntity ? entity : undefined;
};

// Spawns configuration_ak from its point_template if it's missing, then always applies the
// oversized scale and glows it only while the real game hasn't started yet - callers just call
// this whenever the ak needs to be in its "ready to configure" state.
const assertAk = () => {
    if (!findAk()) {
        const spawned = forceSpawnTemplate(AK_POINT_TEMPLATE_NAME);
        if (spawned && spawned.length > 0) {
            spawned[0].SetEntityName(AK_ENTITY_NAME);
        }
    }

    const ak = findAk();
    if (!ak) return;

    ak.SetModelScale(AK_SCALE);

    if (getGameHasStarted()) {
        ak.Unglow();
    } else {
        ak.Glow(GLOW_COLOR);
    }
};

export const onRoundStart = () => {
    assertAk();
};

persistOnReload("configurationweapon", {}, () => {
    assertAk();
});

export const think = () => {
    const ak = findAk();
    if (!ak) return;

    const angles = ak.GetAbsAngles();
    ak.Teleport({
        angles: { pitch: angles.pitch, yaw: angles.yaw + YAW_STEP_DEGREES, roll: angles.roll },
    });
};

// Fired by a trigger's OnTouchStart -> RunScriptInput (activator = the ak) once whoever's carrying
// it leaves the configuration area. Rather than teleporting the dropped instance back - dropping
// and picking the weapon back up spawns a brand new entity each time, which is fragile to chase by
// reference - just remove whatever instance left and spawn a fresh one from
// configuration_ak_point_template, at that template's own authored location.
Instance.OnScriptInput("configuration_ak_left", (event) => {
    const trigger = event.activator;

    if (trigger && trigger.GetClassName() === "weapon_ak47") {
        trigger.Remove();
    }

    assertAk();
});
