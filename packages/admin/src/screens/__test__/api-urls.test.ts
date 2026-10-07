import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const PACKAGES = path.resolve(__dirname, "../../../..");
/** Places where address strings may remain because they define or describe server routes. */
const ALLOWED = [
	/\/core\/src\//,
	/\/(plugin|server)\.ts$/,
	/\/bareun\/src\/(route|options|index)\.ts$/,
	// The Next adapter mounts the server routes and the login API, so it names their paths.
	/\/nextjs\/src\/(route-handler\.ts|auth\/)/,
];

const sources = (dir: string): string[] =>
	readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
		const full = path.join(dir, entry.name);
		if (entry.isDirectory()) return entry.name === "node_modules" || entry.name === "__test__" ? [] : sources(full);
		return /\.(ts|tsx)$/.test(entry.name) && !/\.test\./.test(entry.name) ? [full] : [];
	});

describe("admin API address (basePath)", () => {
	it("admin and extension screen code builds addresses with cmsApiUrl() instead of using /api/cms directly", () => {
		const offenders = readdirSync(PACKAGES)
			.flatMap((name) => sources(path.join(PACKAGES, name, "src")))
			.filter((file) => !ALLOWED.some((pattern) => pattern.test(file)))
			.filter((file) => /["'`]\/api\/cms/.test(readFileSync(file, "utf8")))
			.map((file) => path.relative(PACKAGES, file));
		expect(offenders).toEqual([]);
	});
});
