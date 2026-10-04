import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
/** Config alias names. CMS code reads the two config files through these names. */
export const CONFIG_ALIAS = "@cms-config";
export const SERVER_ALIAS = "@cms-server";
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
/** Alias file listed in tsconfig `paths` (relative to `cwd`). `undefined` if none. */
export function tsconfigAliasPath(cwd, alias) {
    const file = path.join(cwd, "tsconfig.json");
    if (!existsSync(file))
        return undefined;
    const tsconfig = parseJsonc(readFileSync(file, "utf8"));
    const target = tsconfig?.compilerOptions?.paths?.[alias]?.[0];
    if (!target)
        return undefined;
    const base = path.resolve(cwd, tsconfig?.compilerOptions?.baseUrl ?? ".");
    return path.relative(cwd, path.resolve(base, target)) || target;
}
const CANDIDATES = {
    config: ["cms.config.ts", "src/cms.config.ts"],
    server: ["cms.server.ts", "src/cms.server.ts"],
};
/**
 * Locations of the two config files. Looked up in this order: the chosen value (`--config`, `--server`) -> environment variable (`CMS_CONFIG_PATH`, `CMS_SERVER_PATH`) -> the tsconfig `paths`
 * alias -> common locations (`./cms.config.ts`, `./src/cms.config.ts`). It is an error if the file is missing.
 */
export function resolveConfigPaths(cwd, chosen = {}, env = process.env) {
    const find = (kind, alias, envName, flag) => {
        const given = chosen[kind] ?? env[envName];
        const found = given ??
            tsconfigAliasPath(cwd, alias) ??
            CANDIDATES[kind].find((candidate) => existsSync(path.join(cwd, candidate)));
        if (!found || !existsSync(path.resolve(cwd, found))) {
            throw new Error(found
                ? `${alias} file not found: ${found}`
                : `cannot find ${CANDIDATES[kind][0]}; pass ${flag} <path> or set ${envName} (run \`monti init\` to create one)`);
        }
        return found;
    };
    return {
        config: find("config", CONFIG_ALIAS, "CMS_CONFIG_PATH", "--config"),
        server: find("server", SERVER_ALIAS, "CMS_SERVER_PATH", "--server"),
    };
}
