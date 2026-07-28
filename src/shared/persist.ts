import { Instance } from "cs_script/point_script";

type StateSlot<T> = {
    get: () => T;
    set: (value: T) => void;
};

const registry: Record<string, StateSlot<any>> = {};
const afterReloadHooks: (() => void)[] = [];
let registered = false;

export const persistOnReload = (
    namespace: string,
    slots: Record<string, StateSlot<any>>,
    onReloaded?: () => void,
) => {
    for (const key in slots) {
        registry[`${namespace}:${key}`] = slots[key];
    }

    if (onReloaded) {
        afterReloadHooks.push(onReloaded);
    }

    if (registered) return;
    registered = true;

    Instance.OnScriptReload({
        before: () => {
            const memory: Record<string, unknown> = {};
            for (const key in registry) {
                memory[key] = registry[key].get();
            }
            return memory;
        },
        after: (memory) => {
            if (memory) {
                for (const key in registry) {
                    if (memory[key] !== undefined) {
                        registry[key].set(memory[key]);
                    }
                }
            }
            for (const hook of afterReloadHooks) {
                hook();
            }
        },
    });
};
