import { Instance } from "cs_script/point_script";
import { persistOnReload } from "./persist";

type ScheduledCallback = {
    callback: () => void;
    fireAt: number;
};

let scheduled: ScheduledCallback[] = [];

/** Schedules `callback` to run after `delaySeconds` (game time, not ms). Requires `think()` to be pumped from the shared `Instance.SetThink` loop in index.ts. */
export const setTimeout = (callback: () => void, delaySeconds: number): void => {
    scheduled.push({ callback, fireAt: Instance.GetGameTime() + delaySeconds });
};

export const think = (): void => {
    const now = Instance.GetGameTime();
    const remaining: ScheduledCallback[] = [];
    for (const entry of scheduled) {
        if (now >= entry.fireAt) {
            entry.callback();
        } else {
            remaining.push(entry);
        }
    }
    scheduled = remaining;
};

persistOnReload("timers", {
    scheduled: { get: () => scheduled, set: (value) => { scheduled = value; } },
});
