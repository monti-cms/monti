import { access, chmod, mkdir, mkdtemp, readdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { defineSchema } from "./define";
import { type FileCalls, PartialSchemaWrite, readChangeFiles, schemaFilesAt } from "./files";

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

	const changesOf = (root: string) => readdir(path.join(root, "monti", "changes"));
	/** Node's file calls, with `rename` and `writeFile` refusing where `fails` says so. */
	const failing = (fails: { rename?: (to: string) => boolean; write?: (file: string) => boolean }): FileCalls => ({
		access,
		mkdir,
		readdir,
		readFile,
		rm,
		rename: (from, to) =>
			fails.rename?.(String(to)) ? Promise.reject(Object.assign(new Error("EIO"), { code: "EIO" })) : rename(from, to),
		// A write that breaks off: of the schema file itself it leaves a file cut short, as a crash in the middle of a write does.
		writeFile: (async (file: string, ...rest: [string, object?]) => {
			if (!fails.write?.(String(file))) return writeFile(file, ...rest);
			if (String(file).endsWith(".ts")) await writeFile(file, "export default defi");
			throw Object.assign(new Error("ENOSPC"), { code: "ENOSPC" });
		}) as typeof writeFile,
	});
	const other = defineSchema({ ...schema, locales: { ...schema.locales, prefix: "always" } });

	it("12-4 a schema file that cannot be moved into place leaves no change file behind, nor a part of one", async () => {
		const root = await mkdtemp(path.join(tmpdir(), "monti-change-files-"));
		const schemaPath = path.join(root, "monti.schema.ts");
		await writeFile(schemaPath, "// as it was\n");
		const blocked = { on: true };
		const files = schemaFilesAt(root, "monti.schema.ts", failing({ rename: (to) => blocked.on && to === schemaPath }));
		await expect(files.write(other, { id: "one", steps: [] }, true)).rejects.toMatchObject({ code: "EIO" });
		expect(await changesOf(root)).toEqual([]);
		expect(await readdir(root)).toEqual(["monti", "monti.schema.ts"]);
		expect(await readFile(schemaPath, "utf8")).toBe("// as it was\n");
		// Once it can be written, the same change goes through whole.
		blocked.on = false;
		await files.write(other, { id: "one", steps: [] }, true);
		expect(await changesOf(root)).toEqual(["one.json"]);
		expect(await readFile(schemaPath, "utf8")).toContain('prefix: "always"');
	});

	it("12-4 the schema file is never cut short: it is written beside itself and moved over, so a write that breaks off leaves the old file whole", async () => {
		const root = await mkdtemp(path.join(tmpdir(), "monti-change-files-"));
		const schemaPath = path.join(root, "monti.schema.ts");
		await writeFile(schemaPath, "// as it was\n");
		const files = schemaFilesAt(root, "monti.schema.ts", failing({ write: (file) => file.startsWith(schemaPath) }));
		await expect(files.write(other, { id: "one", steps: [] }, true)).rejects.toMatchObject({ code: "ENOSPC" });
		expect(await readFile(schemaPath, "utf8")).toBe("// as it was\n");
		expect(await changesOf(root)).toEqual([]);
	});

	it("12-4 when the change cannot take its name after the schema file was moved in, the schema file is put back as it was", async () => {
		const root = await mkdtemp(path.join(tmpdir(), "monti-change-files-"));
		const schemaPath = path.join(root, "monti.schema.ts");
		await writeFile(schemaPath, "// as it was\n");
		const files = schemaFilesAt(root, "monti.schema.ts", failing({ rename: (to) => to.endsWith("one.json") }));
		await expect(files.write(other, { id: "one", steps: [] }, true)).rejects.toMatchObject({ code: "EIO" });
		// Neither file changed: the new schema was in place for a moment and is gone again.
		expect(await readFile(schemaPath, "utf8")).toBe("// as it was\n");
		expect(await changesOf(root)).toEqual([]);
		expect(await readdir(root)).toEqual(["monti", "monti.schema.ts"]);
	});

	it('12-4 when the schema file cannot be put back either, the write does not say "not written": it fails naming what is on disk', async () => {
		const root = await mkdtemp(path.join(tmpdir(), "monti-change-files-"));
		const schemaPath = path.join(root, "monti.schema.ts");
		await writeFile(schemaPath, "// as it was\n");
		// The change cannot take its name, and from then on the schema file cannot be moved either.
		let namedFailed = false;
		const files = schemaFilesAt(
			root,
			"monti.schema.ts",
			failing({
				rename: (to) => {
					if (to.endsWith("one.json")) namedFailed = true;
					return to.endsWith("one.json") || (namedFailed && to === schemaPath);
				},
			}),
		);
		await expect(files.write(other, { id: "one", steps: [] }, true)).rejects.toBeInstanceOf(PartialSchemaWrite);
		expect(await readFile(schemaPath, "utf8")).toContain('prefix: "always"');
	});

	it("12-4 a write a crash cut off is finished or cleared the next time the files are used", async () => {
		const root = await mkdtemp(path.join(tmpdir(), "monti-change-files-"));
		const schemaPath = path.join(root, "monti.schema.ts");
		const changes = path.join(root, "monti", "changes");
		const files = schemaFilesAt(root);
		await files.write(schema, { id: "first", steps: [] }, true);
		const written = await readFile(schemaPath, "utf8");
		const [first] = await files.readChanges();

		// Stopped after the schema file was moved in, before the change got its name: the change exists, and gets its name.
		await writeFile(
			path.join(changes, "second.json.part"),
			JSON.stringify({ id: "second", steps: [], schema: first?.schema }),
		);
		// Stopped before the schema file was written: nothing of that change happened.
		await writeFile(
			path.join(changes, "third.json.part"),
			JSON.stringify({ id: "third", steps: [], schema: "0000000000000000" }),
		);
		// Stopped in the middle of writing a part, and in the middle of writing the schema beside itself.
		await writeFile(path.join(changes, "fourth.json.part"), '{ "id": "fou');
		await writeFile(`${schemaPath}.part`, "export default defi");

		expect((await files.readChanges()).map((change) => change.id)).toEqual(["first", "second"]);
		expect(await readdir(changes)).toEqual(["first.json", "second.json"]);
		expect(await readdir(root)).toEqual(["monti", "monti.schema.ts"]);
		expect(await readFile(schemaPath, "utf8")).toBe(written);
	});

	// Root writes a file whatever its mark says (a Docker CI runs as root): there the mark cannot be tried.
	it.skipIf(process.getuid?.() === 0)(
		"12-4 a schema file marked read-only is not written, though a file moved over it would go around the mark",
		async () => {
			const root = await mkdtemp(path.join(tmpdir(), "monti-change-files-"));
			const files = schemaFilesAt(root);
			const schemaPath = path.join(root, "monti.schema.ts");
			await writeFile(schemaPath, "// read-only\n");
			await chmod(schemaPath, 0o444);
			await expect(files.write(schema, { id: "one", steps: [] }, true)).rejects.toMatchObject({ code: "EACCES" });
			expect(await readFile(schemaPath, "utf8")).toBe("// read-only\n");
			expect(await changesOf(root)).toEqual([]);
		},
	);
});
