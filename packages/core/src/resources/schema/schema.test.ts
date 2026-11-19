import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { Kysely } from "kysely";
import { afterEach, beforeEach, expect, it } from "vitest";
import { createTestDatabase, type TestDatabase } from "../../__test__/database";
import { migrate } from "../../db/migrate";
import { initial } from "../../db/migrations/0001-initial";
import type { Database } from "../../db/types";
import { createMonti } from "../../engine/engine";
import type { Schema } from "../../engine/types";
import { schema } from "./schema";

let testDb: TestDatabase;
let db: Kysely<Database>;
let dir: string;
let schemaFile: string;
let configFile: string;

const original: Schema = {
	locales: ["ko"],
	collections: { posts: { fields: { title: { type: "text" } } } },
};

const changed: Schema = {
	locales: ["ko", "en"],
	collections: {
		posts: {
			body: true,
			label: "Posts",
			description: "Blog posts",
			fields: {
				title: { type: "text", required: true, max: 80, label: "Title", description: "Shown in the list" },
				views: { type: "number" },
				pinned: { type: "boolean" },
				publishedOn: { type: "date" },
				category: { type: "select", options: ["news", "guide"], many: true },
				cover: { type: "media", many: false },
				tags: { type: "relation", to: "tags", many: true },
				hero: {
					type: "conditional",
					options: {
						image: { fields: { image: { type: "media" } } },
						quote: { fields: { text: { type: "text", max: 200 }, author: { type: "text" } } },
					},
				},
			},
		},
		tags: { fields: { label: { type: "text" } } },
	},
};

/** A schema with a field whose `type` is none of the 8, as an untyped caller would send it. */
const unknownType: Schema = JSON.parse(
	JSON.stringify({ locales: ["ko"], collections: { posts: { fields: { title: { type: "richtext" } } } } }),
);

function montiOf(dev: boolean) {
	return createMonti(db, { schema }, [], {
		schema: original,
		config: { name: "Monti Blog", dev },
		schemaFile,
		configFile,
	});
}

/** The schema the file holds, imported as the app imports it; each test imports its file once, after the action. */
async function schemaInFile(): Promise<Schema> {
	const module: { default: Schema } = await import(schemaFile);
	return module.default;
}

beforeEach(async () => {
	testDb = await createTestDatabase();
	await migrate(testDb.db, "core", [initial]);
	db = testDb.db as Kysely<Database>;
	dir = await mkdtemp(path.join(tmpdir(), "monti-schema-"));
	schemaFile = path.join(dir, "monti.schema.ts");
	configFile = path.join(dir, "monti.config.ts");
	await writeFile(schemaFile, `export default ${JSON.stringify(original)};\n`);
	await writeFile(configFile, `export default { name: "Monti Blog" };\n`);
});

afterEach(async () => {
	await testDb.drop();
	await rm(dir, { recursive: true });
});

it("SCH-GET-1 returns the current schema from schema.get", async () => {
	const monti = montiOf(false);

	// SCH-GET-1.1
	expect(await monti.schema.get({})).toEqual(original);
});

it("SCH-UPD-1 changes the schema and writes it to the schema file on a dev server", async () => {
	const monti = montiOf(true);

	const output = await monti.schema.update(changed);

	// SCH-UPD-1.1
	expect(output).toEqual(changed);
	// SCH-UPD-1.2
	expect(await monti.schema.get({})).toEqual(changed);
	// SCH-UPD-1.3
	expect(await schemaInFile()).toEqual(changed);
});

it("SCH-UPD-2 rejects schema.update with FORBIDDEN when not a dev server", async () => {
	const monti = montiOf(false);

	// SCH-UPD-2.1
	await expect(monti.schema.update(changed)).rejects.toMatchObject({ code: "FORBIDDEN" });
	// SCH-UPD-2.2
	expect(await monti.schema.get({})).toEqual(original);
	// SCH-UPD-2.3
	expect(await schemaInFile()).toEqual(original);
});

it("SCH-UPD-3 leaves the schema and the schema file unchanged when the transaction rolls back", async () => {
	const monti = montiOf(true);

	const rollback = new Error("rollback");
	await monti
		.transaction(async (tx) => {
			await tx.schema.update(changed);
			throw rollback;
		})
		.catch((error: unknown) => {
			if (error !== rollback) throw error;
		});

	// SCH-UPD-3.1
	expect(await monti.schema.get({})).toEqual(original);
	// SCH-UPD-3.2
	expect(await schemaInFile()).toEqual(original);
});

it("SCH-UPD-4 leaves the schema and the schema file unchanged after a dryRun", async () => {
	const monti = montiOf(true);

	await monti.dryRun(async (tx) => {
		await tx.schema.update(changed);
	});

	// SCH-UPD-4.1
	expect(await monti.schema.get({})).toEqual(original);
	// SCH-UPD-4.2
	expect(await schemaInFile()).toEqual(original);
});

it("SCH-UPD-5 rejects schema.update with BAD_REQUEST when a field has an undefined type", async () => {
	const monti = montiOf(true);

	// SCH-UPD-5.1
	await expect(monti.schema.update(unknownType)).rejects.toMatchObject({ code: "BAD_REQUEST" });
	// SCH-UPD-5.2
	expect(await monti.schema.get({})).toEqual(original);
	// SCH-UPD-5.3
	expect(await schemaInFile()).toEqual(original);
});
