import { existsSync } from "node:fs";
import path from "node:path";
/** Where a variable is set, for the `where` of a message: the env files that define it, else the environment. */
export function whereSet(state, name) {
    const files = [...state.envSources].filter(([, values]) => name in values).map(([file]) => file);
    return files.length > 0 ? files.join(", ") : "the environment";
}
/** The text of an error, for a message. */
export const messageOf = (error) => (error instanceof Error ? error.message : String(error));
/** Whether a file exists under the app folder. */
export const exists = (state, file) => existsSync(path.join(state.cwd, file));
