import { Instance, type CSPlayerController } from "cs_script/point_script";

const MAX_PLAYER_SLOTS = 100;

// GetPlayerController(slot) is the only way to find a player who connected before this script had
// loaded - Connect/Activate events can't fire retroactively, so scanning every slot is required.
export const findConnectedPlayerControllers = (): CSPlayerController[] => {
    const controllers: CSPlayerController[] = [];
    for (let slot = 0; slot < MAX_PLAYER_SLOTS; slot++) {
        const controller = Instance.GetPlayerController(slot);
        if (controller && controller.IsValid()) {
            controllers.push(controller);
        }
    }
    return controllers;
};
