import { Instance } from "cs_script/point_script";

// No PrintToChat API exists; issuing "say_team" broadcasts the message into chat.
export const printToChat = (message: string) => {
    Instance.ServerCommand("say_team " + message);
};
