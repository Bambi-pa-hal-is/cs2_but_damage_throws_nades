import { Instance, PointTemplate, type Entity, type QAngle, type Vector } from "cs_script/point_script";

// Finds a point_template entity by name, validates it, and force-spawns it. Logs and returns
// undefined on any failure so callers can bail out with a single check.
export const forceSpawnTemplate = (templateName: string, position: Vector, angle?: QAngle): Entity[] | undefined => {
    const template = Instance.FindEntityByName(templateName);
    if (!template) {
        Instance.Msg(`${templateName} not found`);
        return undefined;
    }
    if (!(template instanceof PointTemplate)) {
        Instance.Msg(`${templateName} is not of type point template`);
        return undefined;
    }

    // Passing an explicit `undefined` angle isn't the same as omitting the argument entirely - the
    // native binding sees an argument was actually passed and tries to validate it as a QAngle,
    // which fails with "bad angle value". Only pass it through when a real angle was given.
    const spawned = angle !== undefined ? template.ForceSpawn(position, angle) : template.ForceSpawn(position);
    if (!spawned || spawned.length === 0) {
        Instance.Msg(`Failed to spawn ${templateName}`);
        return undefined;
    }

    return spawned;
};
