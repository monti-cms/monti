import { chmod, mkdir, mkdtemp, readdir, readFile, writeFile } from "node:fs/promises";
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

	it("12-4 the two files are written as one: a change that cannot take its name leaves the schema file as it was", async () => {
		const root = await mkdtemp(path.join(tmpdir(), "monti-change-files-"));
		const files = schemaFilesAt(root);
		const schemaPath = path.join(root, "monti.schema.ts");
		await writeFile(schemaPath, "// as it was\n");
		await files.write(schema, { id: "taken", steps: [] }, false);
		const other = defineSchema({ ...schema, locales: { ...schema.locales, prefix: "always" } });
		await expect(files.write(other, { id: "taken", steps: [] }, true)).rejects.toMatchObject({ code: "EEXIST" });
		expect(await readFile(schemaPath, "utf8")).toBe("// as it was\n");
		expect(await readdir(path.join(root, "monti", "changes"))).toEqual(["taken.json"]);
	});

	it("12-4 a schema file that cannot be written leaves no change file behind, nor a part of one", async () => {
		const root = await mkdtemp(path.join(tmpdir(), "monti-change-files-"));
		const files = schemaFilesAt(root);
		const schemaPath = path.join(root, "monti.schema.ts");
		await writeFile(schemaPath, "// read-only\n");
		await chmod(schemaPath, 0o444);
		await expect(files.write(schema, { id: "one", steps: [] }, true)).rejects.toMatchObject({ code: "EACCES" });
		expect(await readdir(path.join(root, "monti", "changes"))).toEqual([]);
		expect(await files.readChanges()).toEqual([]);
		// Once it can be written, the same change goes through whole.
		await chmod(schemaPath, 0o644);
		await files.write(schema, { id: "one", steps: [] }, true);
		expect(await readdir(path.join(root, "monti", "changes"))).toEqual(["one.json"]);
		expect(await readFile(schemaPath, "utf8")).toContain("defineSchema");
	});
});
