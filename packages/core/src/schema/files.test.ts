import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { defineSchema } from "./define";
import { readChangeFiles, schemaFilesAt } from "./files";

const schema = defineSchema({
	locales: { source: "en", list: [{ code: "en", name: "English" }], prefix: "never" },
	collections: {},
});

describe("schema change files", () => {
	it("rejects malformed or misnamed files", async () => {
		const root = await mkdtemp(path.join(tmpdir(), "monti-change-files-"));
		const changes = path.join(root, "monti", "changes");
		await mkdir(changes, { recursive: true });
		await writeFile(path.join(changes, "bad.json"), "{}");
		await expect(readChangeFiles(changes)).rejects.toThrow();
		await writeFile(path.join(changes, "bad.json"), JSON.stringify({ id: "other", steps: [] }));
		await expect(readChangeFiles(changes)).rejects.toThrow("does not match its id");
	});

	it("never overwrites an existing change file", async () => {
		const root = await mkdtemp(path.join(tmpdir(), "monti-change-files-"));
		const files = schemaFilesAt(root);
		const first = { id: "same", steps: [{ do: "removeCollection" as const, collection: "post" }] };
		await files.write(schema, first, false);
		await expect(files.write(schema, { id: "same", steps: [] }, false)).rejects.toMatchObject({ code: "EEXIST" });
		expect(await files.readChanges()).toEqual([first]);
	});
});
