import { CustomHudLayout, Entity, Instance } from "cs_script/point_script";

const MAIN_MENU_LAYOUT_NAME = "main_menu_layout";

let mainMenuLayout: CustomHudLayout | undefined;

// The custom_hud_layout entity has to be placed in Hammer (see README) - this just finds it by
// name the same way welcomeHud.ts finds its own layout entity.
export const getMainMenuLayout = (): CustomHudLayout | undefined => {
    if (!(mainMenuLayout instanceof Entity) || !mainMenuLayout.IsValid()) {
        const found = Instance.FindEntitiesByName(MAIN_MENU_LAYOUT_NAME)[0];
        mainMenuLayout = found instanceof CustomHudLayout ? found : undefined;
    }
    return mainMenuLayout;
};
