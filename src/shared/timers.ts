import { Instance } from "cs_script/point_script";

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
    // Snapshot and clear first: a callback can itself call setTimeout (e.g. to reschedule itself
    // every tick), and that must land in the next pass, not get picked up by this same loop.
    const entries = scheduled;
    scheduled = [];
    for (const entry of entries) {
        if (now >= entry.fireAt) {
            entry.callback();
        } else {
            scheduled.push(entry);
        }
    }
};

// scheduled is deliberately NOT persisted across a tools-mode script reload: any queued closure
// (e.g. a self-rescheduling loop) would still reference the pre-reload module's stale bindings.
// Modules that need to keep running across a reload restart themselves via their own
// persistOnReload(..., onReloaded) hook, which gives them a fresh closure instead.
