import { Instance } from "cs_script/point_script";

export const playSound = (entityName: string): void => {
    Instance.EntFireAtName({
        name: entityName,
        value: "1",
        input: "startsound",
    });
};