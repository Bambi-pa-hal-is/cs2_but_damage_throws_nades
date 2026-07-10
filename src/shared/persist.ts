import { Instance } from "cs_script/point_script";

type StateSlot<T> = {
    get: () => T;
    set: (value: T) => void;
};

export const persistOnReload = (slots: Record<string, StateSlot<any>>) => {
    Instance.OnScriptReload({
        before: () => {
            const memory: Record<string, unknown> = {};
            for (const key in slots) {
                memory[key] = slots[key].get();
            }
            return memory;
        },
        after: (memory) => {
            if (!memory) return;
            for (const key in slots) {
                if (memory[key] !== undefined) {
                    slots[key].set(memory[key]);
                }
            }
        },
    });
};
