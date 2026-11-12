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
		// As it was written the first time (with the schema it was written for), not the second one's.
		expect(await files.readChanges()).toEqual([{ ...first, schema }]);
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
			JSON.stringify({ id: "second", steps: [], file: first?.file }),
		);
		// Stopped before the schema file was written: nothing of that change happened.
		await writeFile(
			path.join(changes, "third.json.part"),
			JSON.stringify({ id: "third", steps: [], file: "0000000000000000" }),
		);
		// Stopped in the middle of writing a part, and in the middle of writing the schema beside itself.
		await writeFile(path.join(changes, "fourth.json.part"), '{ "id": "fou');
		await writeFile(`${schemaPath}.part`, "export default defi");

		expect((await files.readChanges()).map((change) => change.id)).toEqual(["first", "second"]);
		expect(await readdir(changes)).toEqual(["first.json", "second.json"]);
		expect(await readdir(root)).toEqual(["monti", "monti.schema.ts"]);
		expect(await readFile(schemaPath, "utf8")).toBe(written);
	});

	/** Node's file calls, with a step that waits until the test lets it go: the moment another process gets to run. */
	const pausing = (at: (step: "write" | "rename", file: string) => boolean) => {
		const gate: { reached?: () => void; release?: () => void } = {};
		const reached = new Promise<void>((resolve) => {
			gate.reached = resolve;
		});
		const released = new Promise<void>((resolve) => {
			gate.release = resolve;
		});
		const wait = async (step: "write" | "rename", file: string) => {
			if (!at(step, file)) return;
			gate.reached?.();
			await released;
		};
		const io: FileCalls = {
			access,
			mkdir,
			readdir,
			readFile,
			rm,
			rename: async (from, to) => {
				await wait("rename", String(to));
				return rename(from, to);
			},
			writeFile: (async (file: string, ...rest: [string, object?]) => {
				await wait("write", String(file));
				return writeFile(file, ...rest);
			}) as typeof writeFile,
		};
		return { io, reached, release: () => gate.release?.() };
	};

	for (const [when, at] of [
		[
			"before the schema file is moved in",
			(step: string, file: string) => step === "write" && file.endsWith("monti.schema.ts.part"),
		],
		[
			"after the schema file is moved in, before the change has its name",
			(step: string, file: string) => step === "rename" && file.endsWith("one.json"),
		],
	] as const)
		it(`12-4 another process that reads the changes while a write is at work (${when}) waits for it: the writer's part is neither removed nor finished for it`, async () => {
			const root = await mkdtemp(path.join(tmpdir(), "monti-change-files-"));
			const schemaPath = path.join(root, "monti.schema.ts");
			await writeFile(schemaPath, "// as it was\n");
			const writer = pausing(at);
			// Two processes on one checkout: each has its own way to the files.
			const writing = schemaFilesAt(root, "monti.schema.ts", writer.io).write(other, { id: "one", steps: [] }, true);
			await writer.reached;
			let read: string[] | null = null;
			const reading = schemaFilesAt(root)
				.readChanges()
				.then((found) => {
					read = found.map((change) => change.id);
				});
			// The reader gets every chance to run while the writer stands still.
			await new Promise((resume) => setTimeout(resume, 150));
			expect(read).toBeNull();
			expect(await changesOf(root)).toContain("one.json.part");
			writer.release();
			// The write ends as if nobody had looked: both files written, nothing left over.
			await writing;
			await reading;
			expect(read).toEqual(["one"]);
			expect(await changesOf(root)).toEqual(["one.json"]);
			expect(await readFile(schemaPath, "utf8")).toContain('prefix: "always"');
		});

	it("12-4 two writes at once go one after the other; a lock a dead process left is taken over, and one still held is waited for only so long", async () => {
		const root = await mkdtemp(path.join(tmpdir(), "monti-change-files-"));
		const changes = path.join(root, "monti", "changes");
		const first = pausing((step, file) => step === "write" && file.endsWith("one.json.part"));
		const one = schemaFilesAt(root, "monti.schema.ts", first.io).write(schema, { id: "one", steps: [] }, true);
		await first.reached;
		const two = schemaFilesAt(root).write(other, { id: "two", steps: [] }, true);
		await new Promise((resume) => setTimeout(resume, 100));
		// The second has not begun: the first holds the files.
		expect(await readdir(changes)).toEqual([".lock"]);
		first.release();
		await Promise.all([one, two]);
		expect(await readdir(changes)).toEqual(["one.json", "two.json"]);
		expect(await readFile(path.join(root, "monti.schema.ts"), "utf8")).toContain('prefix: "always"');

		// A lock from long ago belongs to a process that died: the next write takes it over.
		await writeFile(path.join(changes, ".lock"), "1 dead");
		await schemaFilesAt(root).write(schema, { id: "three", steps: [] }, true);
		expect(await readdir(changes)).toEqual(["one.json", "three.json", "two.json"]);
		// One just taken is someone at work: waited for, and given up on after the wait.
		await writeFile(path.join(changes, ".lock"), `${Date.now()} alive`);
		const impatient = { staleMs: 60_000, waitMs: 100, pollMs: 10 };
		await expect(
			schemaFilesAt(root, "monti.schema.ts", undefined, impatient).write(schema, { id: "four", steps: [] }, true),
		).rejects.toThrow("in use");
		expect(await readdir(changes)).toEqual([".lock", "one.json", "three.json", "two.json"]);
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
