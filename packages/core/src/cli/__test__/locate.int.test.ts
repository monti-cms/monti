import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { SetupError } from "../../core/problem";
import { locateConfig, locateExtractConfig, locateSchema } from "../locate";

let dirs: string[] = [];
afterEach(() => {
	for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
	dirs = [];
});
const folder = (...files: string[]) => {
	const dir = mkdtempSync(path.join(tmpdir(), "monti-locate-"));
	dirs.push(dir);
	for (const file of files) {
		mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
		writeFileSync(path.join(dir, file), "");
	}
	return dir;
};

describe("finding the config, extract and schema files", () => {
	const lookups = [
		["config", (cwd: string, chosen?: string) => locateConfig(cwd, chosen, {}), "monti.config.ts"],
		["extract config", locateExtractConfig, "cms.config.ts"],
		["schema", locateSchema, "monti.schema.ts"],
	] as const;

	it.each(lookups)("CLI-C1 the %s lookup finds a usual location and honours the chosen path", (_, locate, usual) => {
		expect(locate(folder(usual))).toBe(usual);
		expect(locate(folder(`src/${usual}`))).toBe(`src/${usual}`);
		expect(locate(folder(usual, "other.ts"), "other.ts")).toBe("other.ts");
	});

	it.each(
		lookups,
	)("CLI-C1 a missing %s file is a SetupError that says where it looked and how to fix it", (_, locate) => {
		for (const attempt of [() => locate(folder()), () => locate(folder(), "nope.ts")]) {
			let thrown: unknown;
			try {
				attempt();
			} catch (error) {
				thrown = error;
			}
			expect(thrown).toBeInstanceOf(SetupError);
			expect((thrown as SetupError).message).toMatch(/Where: .*Fix: /);
		}
	});

	it("SCHEMA-S4 a legacy cms.config.ts is read by schema:extract only", () => {
		const dir = folder("cms.config.ts");
		expect(locateExtractConfig(dir)).toBe("cms.config.ts");
		expect(() => locateConfig(dir, undefined, {})).toThrow(SetupError);
	});
});

describe("monti command helpers", () => {
	let dirs: string[] = [];
	afterEach(() => {
		for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
		dirs = [];
	});
	const tempDir = (files: Record<string, string>) => {
		const dir = mkdtempSync(path.join(tmpdir(), "cms-cli-"));
		dirs.push(dir);
		for (const [file, content] of Object.entries(files)) {
			mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
			writeFileSync(path.join(dir, file), content);
		}
		return dir;
	};

	it("CLI-C1 finds monti.config.ts from `--config`, `MONTI_CONFIG_PATH`, else common locations", () => {
		const root = tempDir({ "monti.config.ts": "", "src/monti.config.ts": "", "custom/config.ts": "" });
		// The root file wins over the one in `src`.
		expect(locateConfig(root, undefined, {})).toBe("monti.config.ts");
		const inSrc = tempDir({ "src/monti.config.ts": "" });
		expect(locateConfig(inSrc, undefined, {})).toBe("src/monti.config.ts");
		// The chosen value beats the environment variable, which beats the common locations.
		expect(locateConfig(root, "custom/config.ts", { MONTI_CONFIG_PATH: "src/monti.config.ts" })).toBe(
			"custom/config.ts",
		);
		expect(locateConfig(root, undefined, { MONTI_CONFIG_PATH: "src/monti.config.ts" })).toBe("src/monti.config.ts");
		expect(() => locateConfig(tempDir({}), undefined, {})).toThrow(/monti init/);
		expect(() => locateConfig(root, "nope.ts", {})).toThrow(/nope\.ts.*does not exist.*--config.*Fix:/);
		expect(() => locateConfig(root, undefined, { MONTI_CONFIG_PATH: "nope.ts" })).toThrow(
			/nope\.ts.*does not exist.*MONTI_CONFIG_PATH.*Fix:/,
		);
		// The old server file is not looked for any more.
		expect(() => locateConfig(tempDir({ "cms.server.ts": "" }), undefined, {})).toThrow(/monti init/);
	});
});
