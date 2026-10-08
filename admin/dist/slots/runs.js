import { createStateStore } from "../hooks/store.js";
export const IDLE = { status: "idle" };
export function createSlotRuns() {
    const store = createStateStore({ runs: {} });
    const controllers = new Map();
    const get = (key) => store.getState().runs[key] ?? IDLE;
    return {
        store,
        get,
        set: (key, state) => {
            if (state.status === "idle" && !(key in store.getState().runs))
                return;
            store.setState(({ runs }) => {
                const { [key]: _previous, ...rest } = runs;
                return { runs: state.status === "idle" ? rest : { ...rest, [key]: state } };
            });
        },
        begin: (key) => {
            controllers.get(key)?.abort();
            const controller = new AbortController();
            controllers.set(key, controller);
            return controller;
        },
        abort: (key) => {
            controllers.get(key)?.abort();
            controllers.delete(key);
        },
        isCurrent: (key, controller) => controllers.get(key) === controller && !controller.signal.aborted,
    };
}
