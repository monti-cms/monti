import { existsSync } from "node:fs";
import path from "node:path";
import { problemError } from "../core/problem.js";
/** Reads JSON with comments and trailing commas (tsconfig). Leaves `//` and `/*` inside strings alone. `undefined` if it cannot be read. */
export function parseJsonc(text) {
    let out = "";
    let inString = false;
    for (let index = 0; index < text.length; index++) {
        const char = text[index];
        const next = text[index + 1];
        if (inString) {
            out += char;
            if (char === "\\") {
                out += next ?? "";
                index++;
            }
            else if (char === '"')
                inString = false;
            continue;
        }
        if (char === '"') {
            inString = true;
            out += char;
        }
        else if (char === "/" && next === "/") {
            while (index < text.length && text[index] !== "\n")
                index++;
            out += "\n";
        }
        else if (char === "/" && next === "*") {
            index += 2;
            while (index < text.length && !(text[index] === "*" && text[index + 1] === "/"))
                index++;
            index++;
        }
        else
            out += char;
    }
    try {
        return JSON.parse(out.replace(/,(\s*[}\]])/g, "$1"));
    }
    catch {
        return undefined;
    }
}
/** Candidate locations of the config file, the module that exports the CMS instance as `cms`. */
export const CONFIG_CANDIDATES = ["monti.config.ts", "src/monti.config.ts"];
/**
 * Location of the config file (`monti.config.ts`, the module that exports the CMS instance as `cms`). Looked up in this order: the chosen value
 * (`--config`) -> the `MONTI_CONFIG_PATH` environment variable -> common locations (`./monti.config.ts`, `./src/monti.config.ts`). Relative to `cwd`.
 * It is an error if the file is missing.
 */
export function resolveConfigPath(cwd, chosen = undefined, env = process.env) {
    const found = chosen ??
        (env.MONTI_CONFIG_PATH || undefined) ??
        CONFIG_CANDIDATES.find((candidate) => existsSync(path.join(cwd, candidate)));
    if (!found || !existsSync(path.resolve(cwd, found))) {
        throw problemError(found
            ? {
                what: `The config file ${found} does not exist`,
                where: chosen ? "the --config option" : "the MONTI_CONFIG_PATH environment variable",
                fix: `correct the path (it is relative to ${cwd}), or remove the option so \`monti\` looks for ${CONFIG_CANDIDATES.join(" or ")}`,
            }
            : {
                what: `Cannot find ${CONFIG_CANDIDATES[0]} (looked in ${cwd}, also under src/)`,
                where: "the folder you ran `monti` in",
                fix: "run `monti` from the folder of your Next app, or point at the file with --config <path> or MONTI_CONFIG_PATH; `monti init` creates one in an app that has none",
            }, undefined, "config_missing");
    }
    return found;
}
