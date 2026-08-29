import { CSPlayerController, CustomHudLayout, Entity, Instance } from "cs_script/point_script";

const WELCOME_LAYOUT_NAME = "welcome_layout";

let welcomeLayout: CustomHudLayout | undefined;

const getWelcomeLayout = (): CustomHudLayout | undefined => {
    if (!(welcomeLayout instanceof Entity) || !welcomeLayout.IsValid()) {
        const found = Instance.FindEntitiesByName(WELCOME_LAYOUT_NAME)[0];
        welcomeLayout = found instanceof CustomHudLayout ? found : undefined;
    }
    return welcomeLayout;
};

const showWelcome = (playerSlot: number) => {
    const layout = getWelcomeLayout();
    if (!layout) return;
    layout.SetHasClassForPlayer(playerSlot, "dialog", "Dismissed", false);
    layout.SetInputCaptureEnabled(playerSlot, true);
};

const hideWelcome = (playerSlot: number) => {
    const layout = getWelcomeLayout();
    if (!layout) return;
    layout.SetHasClassForPlayer(playerSlot, "dialog", "Dismissed", true);
    layout.SetInputCaptureEnabled(playerSlot, false);
};

// Exported instead of self-registered via Instance.OnPlayerActivate - only one callback can be
// registered per event name, and index.ts already owns the shared OnPlayerActivate dispatch.
export const onPlayerActivate = (event: { player: CSPlayerController }) => {
    showWelcome(event.player.GetPlayerSlot());
};

// Exported instead of self-registered via Instance.OnCustomHudClicked - only one callback can be
// registered per event name, and index.ts owns the shared OnCustomHudClicked dispatch.
export const onCustomHudClicked = (event: { player: CSPlayerController, layout: CustomHudLayout, buttonId: string }) => {
    if (event.layout === getWelcomeLayout() && event.buttonId === "dismiss_button") {
        hideWelcome(event.player.GetPlayerSlot());
    }
};


Instance.RegisterCheatCommand("bajs_mannen", () => {
    for (const player of Instance.GetAllPlayerControllers()) {
        showWelcome(player.GetPlayerSlot());
    }
});
