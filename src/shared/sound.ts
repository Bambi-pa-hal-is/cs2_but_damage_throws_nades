import { Instance } from "cs_script/point_script";

export const playSound = (entityName: string): void => {
    Instance.EntFireAtName({
        name: entityName,
        value: "1",
        input: "startsound",
    });
};
// Same as playSound, but only the player in `playerSlot` hears it.
export const playSoundForPlayer = (entityName: string, playerSlot: number): void => {
    Instance.EntFireAtName({
        name: entityName,
        input: "StartSoundOnSingleClient",
        value: playerSlot,
    });
};
