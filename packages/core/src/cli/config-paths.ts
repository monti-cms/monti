import { existsSync } from "node:fs";
import path from "node:path";

/** Reads JSON with comments and trailing commas (tsconfig). Leaves `//` and `/*` inside strings alone. `undefined` if it cannot be read. */
export function parseJsonc(text: string): unknown {
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
			} else if (char === '"') inString = false;
			continue;
		}
		if (char === '"') {
			inString = true;
			out += char;
		} else if (char === "/" && next === "/") {
			while (index < text.length && text[index] !== "\n") index++;
			out += "\n";
		} else if (char === "/" && next === "*") {
			index += 2;
			while (index < text.length && !(text[index] === "*" && text[index + 1] === "/")) index++;
			index++;
		} else out += char;
	}
	try {
		return JSON.parse(out.replace(/,(\s*[}\]])/g, "$1"));
	} catch {
		return undefined;
	}
}

/** Candidate locations of the server file, the module that exports the CMS instance as `cms`. */
const SERVER_CANDIDATES = ["cms.server.ts", "src/cms.server.ts"] as const;

/**
 * Location of the server file (the module that exports the CMS instance, which imports the site config itself). Looked up in this order: the chosen value
 * (`--server`) -> the `CMS_SERVER_PATH` environment variable -> common locations (`./cms.server.ts`, `./src/cms.server.ts`). Relative to `cwd`.
 * It is an error if the file is missing.
 */
export function resolveServerPath(
	cwd: string,
	chosen: string | undefined = undefined,
	env: Record<string, string | undefined> = process.env,
): string {
	const found =
		chosen ?? env.CMS_SERVER_PATH ?? SERVER_CANDIDATES.find((candidate) => existsSync(path.join(cwd, candidate)));
	if (!found || !existsSync(path.resolve(cwd, found))) {
		throw new Error(
			found
				? `server file not found: ${found}`
				: `cannot find ${SERVER_CANDIDATES[0]}; pass --server <path> or set CMS_SERVER_PATH (run \`monti init\` to create one)`,
		);
	}
	return found;
}
