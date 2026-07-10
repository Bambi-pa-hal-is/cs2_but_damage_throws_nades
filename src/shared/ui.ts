import { Instance, type Entity } from "cs_script/point_script";

export const setEntityMessage = (target: Entity, message: string, delay = 0) => {
    Instance.EntFireAtTarget({ target, input: "setmessage", value: message, delay });
};

export const setEntityMessageByName = (entityName: string, message: string, delay = 0) => {
    Instance.EntFireAtName({ name: entityName, input: "setmessage", value: message, delay });
};
