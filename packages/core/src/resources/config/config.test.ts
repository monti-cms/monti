import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { Kysely } from "kysely";
import { afterEach, beforeEach, expect, it } from "vitest";
import { createTestDatabase, type TestDatabase } from "../../__test__/database";
import { migrate } from "../../db/migrate";
import { initial } from "../../db/migrations/0001-initial";
import type { Database } from "../../db/types";
import { createMonti } from "../../engine/engine";
import type { MontiConfig } from "../../engine/types";
import { config } from "./config";

let testDb: TestDatabase;
let db: Kysely<Database>;
let dir: string;
let schemaFile: string;
let configFile: string;

/** A config file with more than the name in it: a comment, other settings and a name of a plugin after the site's. */
const originalText = `// The site's settings.
export default {
	name: "Monti Blog", dev: true,
	plugins: [{ name: "monti-plugin-search" }],
};
`;

const newName = "Monti Journal";

function montiOf(dev: boolean) {
	return createMonti(db, { config }, [], {
		schema: { locales: ["ko"], collections: {} },
		config: { name: "Monti Blog", dev },
		schemaFile,
		configFile,
	});
}

/** The site name the file holds, imported as the app imports it; each test imports its file once, after the action. */
async function nameInFile(): Promise<string> {
	const module: { default: MontiConfig } = await import(configFile);
	return module.default.name;
}

beforeEach(async () => {
	testDb = await createTestDatabase();
	await migrate(testDb.db, "core", [initial]);
	db = testDb.db as Kysely<Database>;
	dir = await mkdtemp(path.join(tmpdir(), "monti-config-"));
	schemaFile = path.join(dir, "monti.schema.ts");
	configFile = path.join(dir, "monti.config.ts");
	await writeFile(schemaFile, `export default { locales: ["ko"], collections: {} };\n`);
	await writeFile(configFile, originalText);
});

afterEach(async () => {
	await testDb.drop();
	await rm(dir, { recursive: true });
});

it("CFG-GET-1 returns the current site config from config.get", async () => {
	const monti = montiOf(false);

	// CFG-GET-1.1
	expect(await monti.config.get({})).toEqual({ name: "Monti Blog", dev: false });
});

it("CFG-UPD-1 renames the site and writes the name to the config file on a dev server", async () => {
	const monti = montiOf(true);

	const output = await monti.config.update({ name: newName });

	// CFG-UPD-1.1
	expect(output.name).toBe(newName);
	// CFG-UPD-1.2
	expect(await monti.config.get({})).toEqual({ name: newName, dev: true });
	// CFG-UPD-1.3
	expect(await nameInFile()).toBe(newName);
	// CFG-UPD-1.4
	expect(await readFile(configFile, "utf8")).toBe(originalText.replace('"Monti Blog"', JSON.stringify(newName)));
});

it("CFG-UPD-2 rejects config.update with FORBIDDEN when not a dev server", async () => {
	const monti = montiOf(false);

	// CFG-UPD-2.1
	await expect(monti.config.update({ name: newName })).rejects.toMatchObject({ code: "FORBIDDEN" });
	// CFG-UPD-2.2
	expect(await monti.config.get({})).toEqual({ name: "Monti Blog", dev: false });
	// CFG-UPD-2.3
	expect(await readFile(configFile, "utf8")).toBe(originalText);
});

it("CFG-UPD-3 leaves the config and the config file unchanged when the transaction rolls back", async () => {
	const monti = montiOf(true);

	const rollback = new Error("rollback");
	await monti
		.transaction(async (tx) => {
			await tx.config.update({ name: newName });
			throw rollback;
		})
		.catch((error: unknown) => {
			if (error !== rollback) throw error;
		});

	// CFG-UPD-3.1
	expect(await monti.config.get({})).toEqual({ name: "Monti Blog", dev: true });
	// CFG-UPD-3.2
	expect(await readFile(configFile, "utf8")).toBe(originalText);
});

it("CFG-UPD-4 leaves the config and the config file unchanged after a dryRun", async () => {
	const monti = montiOf(true);

	await monti.dryRun(async (tx) => {
		await tx.config.update({ name: newName });
	});

	// CFG-UPD-4.1
	expect(await monti.config.get({})).toEqual({ name: "Monti Blog", dev: true });
	// CFG-UPD-4.2
	expect(await readFile(configFile, "utf8")).toBe(originalText);
});
