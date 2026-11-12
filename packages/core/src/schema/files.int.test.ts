import { access, chmod, mkdir, mkdtemp, readdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { Kysely, PostgresDialect, sql } from "kysely";
import { Pool } from "pg";
import { describe, expect, it } from "vitest";
import { testDatabase } from "../__test__/database";
import type { Database } from "../db/schema";
import { defineSchema } from "./define";
import { type FileCalls, PartialSchemaWrite, SchemaFilesBusy, schemaFilesAt } from "./files";

const db = await testDatabase();

const schema = defineSchema({
	locales: { source: "en", list: [{ code: "en", name: "English" }], prefix: "never" },
	collections: {},
});
const other = defineSchema({ ...schema, locales: { ...schema.locales, prefix: "always" } });

const checkout = () => mkdtemp(path.join(tmpdir(), "monti-change-files-"));
const changesOf = (root: string) => readdir(path.join(root, "monti", "changes"));

describe("schema change files", () => {
	it("never overwrites an existing change file", async () => {
		const root = await checkout();
		const files = schemaFilesAt(root);
		const first = { id: "same", steps: [{ do: "removeCollection" as const, collection: "post" }] };
		await files.write(db, schema, first, false);
		await expect(files.write(db, schema, { id: "same", steps: [] }, false)).rejects.toMatchObject({ code: "EEXIST" });
		// As it was written the first time (with the schema it was written for), not the second one's.
		expect(await files.readChanges(db)).toEqual([{ ...first, schema }]);
	});

	it("12-4 the two files are written as one: a change that cannot take its name leaves the schema file as it was", async () => {
		const root = await checkout();
		const files = schemaFilesAt(root);
		const schemaPath = path.join(root, "monti.schema.ts");
		await writeFile(schemaPath, "// as it was\n");
		await files.write(db, schema, { id: "taken", steps: [] }, false);
		await expect(files.write(db, other, { id: "taken", steps: [] }, true)).rejects.toMatchObject({ code: "EEXIST" });
		expect(await readFile(schemaPath, "utf8")).toBe("// as it was\n");
		expect(await changesOf(root)).toEqual(["taken.json"]);
	});

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

	it("12-4 a schema file that cannot be moved into place leaves no change file behind, nor a part of one", async () => {
		const root = await checkout();
		const schemaPath = path.join(root, "monti.schema.ts");
		await writeFile(schemaPath, "// as it was\n");
		const blocked = { on: true };
		const files = schemaFilesAt(root, "monti.schema.ts", failing({ rename: (to) => blocked.on && to === schemaPath }));
		await expect(files.write(db, other, { id: "one", steps: [] }, true)).rejects.toMatchObject({ code: "EIO" });
		expect(await changesOf(root)).toEqual([]);
		expect(await readdir(root)).toEqual(["monti", "monti.schema.ts"]);
		expect(await readFile(schemaPath, "utf8")).toBe("// as it was\n");
		// Once it can be written, the same change goes through whole.
		blocked.on = false;
		await files.write(db, other, { id: "one", steps: [] }, true);
		expect(await changesOf(root)).toEqual(["one.json"]);
		expect(await readFile(schemaPath, "utf8")).toContain('prefix: "always"');
	});

	it("12-4 the schema file is never cut short: it is written beside itself and moved over, so a write that breaks off leaves the old file whole", async () => {
		const root = await checkout();
		const schemaPath = path.join(root, "monti.schema.ts");
		await writeFile(schemaPath, "// as it was\n");
		const files = schemaFilesAt(root, "monti.schema.ts", failing({ write: (file) => file.startsWith(schemaPath) }));
		await expect(files.write(db, other, { id: "one", steps: [] }, true)).rejects.toMatchObject({ code: "ENOSPC" });
		expect(await readFile(schemaPath, "utf8")).toBe("// as it was\n");
		expect(await changesOf(root)).toEqual([]);
	});

	it("12-4 when the change cannot take its name after the schema file was moved in, the schema file is put back as it was", async () => {
		const root = await checkout();
		const schemaPath = path.join(root, "monti.schema.ts");
		await writeFile(schemaPath, "// as it was\n");
		const files = schemaFilesAt(root, "monti.schema.ts", failing({ rename: (to) => to.endsWith("one.json") }));
		await expect(files.write(db, other, { id: "one", steps: [] }, true)).rejects.toMatchObject({ code: "EIO" });
		// Neither file changed: the new schema was in place for a moment and is gone again.
		expect(await readFile(schemaPath, "utf8")).toBe("// as it was\n");
		expect(await changesOf(root)).toEqual([]);
		expect(await readdir(root)).toEqual(["monti", "monti.schema.ts"]);
	});

	it('12-4 when the schema file cannot be put back either, the write does not say "not written": it fails naming what is on disk', async () => {
		const root = await checkout();
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
		await expect(files.write(db, other, { id: "one", steps: [] }, true)).rejects.toBeInstanceOf(PartialSchemaWrite);
		expect(await readFile(schemaPath, "utf8")).toContain('prefix: "always"');
	});

	/** What a crash in the middle of a write leaves: a change whose schema file is in place (`second`), and parts nothing came of. */
	const crashed = async (root: string) => {
		const schemaPath = path.join(root, "monti.schema.ts");
		const changes = path.join(root, "monti", "changes");
		const files = schemaFilesAt(root);
		await files.write(db, schema, { id: "first", steps: [] }, true);
		const [first] = await files.readChanges(db);
		// Stopped after the schema file was moved in, before the change got its name: the change exists, and gets its name.
		await writeFile(
			path.join(changes, "second.json.part"),
			JSON.stringify({ id: "second", steps: [], file: first?.file }),
		);
		return { schemaPath, changes, files, written: await readFile(schemaPath, "utf8") };
	};

	it("12-4 a write a crash cut off is finished or cleared the next time the files are used", async () => {
		const root = await checkout();
		const { schemaPath, changes, files, written } = await crashed(root);
		// Stopped before the schema file was written: nothing of that change happened.
		await writeFile(
			path.join(changes, "third.json.part"),
			JSON.stringify({ id: "third", steps: [], file: "0000000000000000" }),
		);
		// Stopped in the middle of writing a part, and in the middle of writing the schema beside itself.
		await writeFile(path.join(changes, "fourth.json.part"), '{ "id": "fou');
		await writeFile(`${schemaPath}.part`, "export default defi");

		expect((await files.readChanges(db)).map((change) => change.id)).toEqual(["first", "second"]);
		expect(await readdir(changes)).toEqual(["first.json", "second.json"]);
		expect(await readdir(root)).toEqual(["monti", "monti.schema.ts"]);
		expect(await readFile(schemaPath, "utf8")).toBe(written);
	});

	/**
	 * Node's file calls, with a step that waits until the test lets it go: the moment another process gets to run. `die` is the process ending
	 * there: from then on none of its file calls does anything.
	 */
	const pausing = (at: (step: "write" | "rename", file: string) => boolean) => {
		const gate: { reached?: () => void; release?: () => void } = {};
		const reached = new Promise<void>((resolve) => {
			gate.reached = resolve;
		});
		const released = new Promise<void>((resolve) => {
			gate.release = resolve;
		});
		const state = { dead: false, moved: [] as string[] };
		const alive = () => {
			if (state.dead) throw new Error("This process ended.");
		};
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
			rm: (async (...args: Parameters<typeof rm>) => {
				alive();
				return rm(...args);
			}) as typeof rm,
			rename: async (from, to) => {
				await wait("rename", String(to));
				alive();
				await rename(from, to);
				state.moved.push(path.basename(String(to)));
			},
			writeFile: (async (file: string, ...rest: [string, object?]) => {
				await wait("write", String(file));
				alive();
				return writeFile(file, ...rest);
			}) as typeof writeFile,
		};
		return {
			io,
			reached,
			moved: state.moved,
			release: () => gate.release?.(),
			die: () => {
				state.dead = true;
				gate.release?.();
			},
		};
	};
	const tick = (ms: number) => new Promise((resume) => setTimeout(resume, ms));
	/** Another process's way to the files, which gives up on the lock after a moment instead of the ten seconds a real one waits. */
	const impatient = (root: string) => schemaFilesAt(root, "monti.schema.ts", undefined, 100);

	const moments = [
		[
			"before the schema file is moved in",
			(step: string, file: string) => step === "write" && file.endsWith("monti.schema.ts.part"),
		],
		[
			"after the schema file is moved in, before the change has its name",
			(step: string, file: string) => step === "rename" && file.endsWith("one.json"),
		],
	] as const;

	for (const [when, at] of moments) {
		it(`12-4 another process that reads the changes while a write is at work (${when}) waits for it: the writer's part is neither removed nor finished for it`, async () => {
			const root = await checkout();
			const schemaPath = path.join(root, "monti.schema.ts");
			await writeFile(schemaPath, "// as it was\n");
			const writer = pausing(at);
			// Two processes on one checkout: each has its own way to the files and its own database session.
			const writing = schemaFilesAt(root, "monti.schema.ts", writer.io).write(
				db,
				other,
				{ id: "one", steps: [] },
				true,
			);
			await writer.reached;
			let read: string[] | null = null;
			const reading = schemaFilesAt(root)
				.readChanges(db)
				.then((found) => {
					read = found.map((change) => change.id);
				});
			// The reader gets every chance to run while the writer stands still.
			await tick(150);
			expect(read).toBeNull();
			expect(await changesOf(root)).toEqual(["one.json.part"]);
			writer.release();
			// The write ends as if nobody had looked: both files written, nothing left over.
			await writing;
			await reading;
			expect(read).toEqual(["one"]);
			expect(await changesOf(root)).toEqual(["one.json"]);
			expect(await readFile(schemaPath, "utf8")).toContain('prefix: "always"');
		});

		it(`12-4 a writer that stands still for longer than anyone waits (${when}) is never taken for dead: the reader is told the files are busy and touches nothing, and the write then ends whole`, async () => {
			const root = await checkout();
			const schemaPath = path.join(root, "monti.schema.ts");
			await writeFile(schemaPath, "// as it was\n");
			const writer = pausing(at);
			const writing = schemaFilesAt(root, "monti.schema.ts", writer.io).write(
				db,
				other,
				{ id: "one", steps: [] },
				true,
			);
			await writer.reached;
			const paused = await readFile(schemaPath, "utf8");
			// The reader's whole wait runs out, twice over: no length of time makes the writer's part anyone else's.
			for (const _ of [1, 2]) {
				const refused = await impatient(root)
					.readChanges(db)
					.catch((error: unknown) => error);
				expect(refused).toBeInstanceOf(SchemaFilesBusy);
				expect(refused).toMatchObject({ reason: { key: "schema.filesBusy" } });
			}
			expect(await changesOf(root)).toEqual(["one.json.part"]);
			expect(await readFile(schemaPath, "utf8")).toBe(paused);
			writer.release();
			// The writer finds its part where it left it: the change takes its name and the schema file is the new one, not put back.
			await writing;
			expect(await changesOf(root)).toEqual(["one.json"]);
			expect(await readFile(schemaPath, "utf8")).toContain('prefix: "always"');
			expect((await impatient(root).readChanges(db)).map((change) => change.id)).toEqual(["one"]);
		});
	}

	it("12-4 two processes that find a crashed write at once finish it once: the second waits for the first and finds nothing left to do", async () => {
		const root = await checkout();
		const { changes, written, schemaPath } = await crashed(root);
		// The first stands still in the middle of giving the change its name.
		const first = pausing((step, file) => step === "rename" && file.endsWith("second.json"));
		const second = pausing(() => false);
		const one = schemaFilesAt(root, "monti.schema.ts", first.io).readChanges(db);
		await first.reached;
		let found: string[] | null = null;
		const two = schemaFilesAt(root, "monti.schema.ts", second.io)
			.readChanges(db)
			.then((read) => {
				found = read.map((change) => change.id);
			});
		await tick(150);
		// The second has done nothing: the part is still the first's to finish.
		expect(found).toBeNull();
		expect(await readdir(changes)).toEqual(["first.json", "second.json.part"]);
		first.release();
		expect((await one).map((change) => change.id)).toEqual(["first", "second"]);
		await two;
		expect(found).toEqual(["first", "second"]);
		// Named once, by the one that held the files.
		expect(first.moved).toEqual(["second.json"]);
		expect(second.moved).toEqual([]);
		expect(await readdir(changes)).toEqual(["first.json", "second.json"]);
		expect(await readFile(schemaPath, "utf8")).toBe(written);
	});

	it("12-4 a recovery that stands still is not taken over by a writer either: the write is told the files are busy and leaves nothing", async () => {
		const root = await checkout();
		const { changes, written, schemaPath } = await crashed(root);
		const first = pausing((step, file) => step === "rename" && file.endsWith("second.json"));
		const one = schemaFilesAt(root, "monti.schema.ts", first.io).readChanges(db);
		await first.reached;
		await expect(impatient(root).write(db, other, { id: "third", steps: [] }, true)).rejects.toBeInstanceOf(
			SchemaFilesBusy,
		);
		expect(await readdir(changes)).toEqual(["first.json", "second.json.part"]);
		expect(await readFile(schemaPath, "utf8")).toBe(written);
		first.release();
		await one;
		// Free again: the same write goes through.
		await impatient(root).write(db, other, { id: "third", steps: [] }, true);
		expect(await readdir(changes)).toEqual(["first.json", "second.json", "third.json"]);
	});

	/** A process of its own: a connection to the same site that can be cut, as a process that dies cuts its own. */
	const process_ = async () => {
		const found = await sql<{ name: string }>`select current_schema() as name`.execute(db);
		const pool = new Pool({
			connectionString: process.env.CMS_TEST_DATABASE_URL,
			options: `-c search_path=${found.rows[0]?.name}`,
			max: 1,
		});
		// A connection cut from outside says so to whoever listens; nobody here is surprised by it.
		pool.on("error", () => {});
		pool.on("connect", (client) => client.on("error", () => {}));
		const own = new Kysely<Database>({ dialect: new PostgresDialect({ pool }) });
		return { db: own, end: () => own.destroy().catch(() => {}) };
	};

	it("12-4 a writer that died in the middle holds nothing: while it lives the reader is told busy, and once its session is gone the reader finishes its write", async () => {
		const root = await checkout();
		const schemaPath = path.join(root, "monti.schema.ts");
		await writeFile(schemaPath, "// as it was\n");
		const dying = await process_();
		const writer = pausing((step, file) => step === "rename" && file.endsWith("one.json"));
		let pid = 0;
		const writing = dying.db
			.transaction()
			.execute(async (trx) => {
				pid = (await sql<{ pid: number }>`select pg_backend_pid() as pid`.execute(trx)).rows[0]?.pid ?? 0;
				await schemaFilesAt(root, "monti.schema.ts", writer.io).write(trx, other, { id: "one", steps: [] }, true);
			})
			.catch((error: unknown) => error);
		await writer.reached;
		// Alive and standing still: its part is its own.
		await expect(impatient(root).readChanges(db)).rejects.toBeInstanceOf(SchemaFilesBusy);
		expect(await changesOf(root)).toEqual(["one.json.part"]);

		// The process ends where it stood: its session goes with it, and it does nothing more to the files.
		writer.die();
		await sql`select pg_terminate_backend(${pid})`.execute(db);
		// The schema file was moved in before it died, so the change exists: the next reader gives it its name. No timeout decided that.
		expect((await schemaFilesAt(root).readChanges(db)).map((change) => change.id)).toEqual(["one"]);
		expect(await changesOf(root)).toEqual(["one.json"]);
		expect(await readFile(schemaPath, "utf8")).toContain('prefix: "always"');
		expect(await writing).toBeInstanceOf(Error);
		await dying.end();
	});

	it("12-4 two writes at once go one after the other, and no lock file is left in the checkout", async () => {
		const root = await checkout();
		const changes = path.join(root, "monti", "changes");
		const first = pausing((step, file) => step === "write" && file.endsWith("one.json.part"));
		const one = schemaFilesAt(root, "monti.schema.ts", first.io).write(db, schema, { id: "one", steps: [] }, true);
		await first.reached;
		const two = schemaFilesAt(root).write(db, other, { id: "two", steps: [] }, true);
		await tick(100);
		// The second has not begun: the first holds the files.
		expect(await readdir(changes)).toEqual([]);
		first.release();
		await Promise.all([one, two]);
		expect(await readdir(changes)).toEqual(["one.json", "two.json"]);
		expect(await readdir(root)).toEqual(["monti", "monti.schema.ts"]);
		expect(await readFile(path.join(root, "monti.schema.ts"), "utf8")).toContain('prefix: "always"');
	});

	it("12-4 reading the changes takes no lock when no write was cut off: a reader is not held up by a write's open transaction", async () => {
		const root = await checkout();
		const files = schemaFilesAt(root);
		await db.transaction().execute(async (trx) => {
			await files.write(trx, schema, { id: "one", steps: [] }, true);
			// The write's transaction is still open and holds the files; its part is gone, so there is nothing for a reader to wait for.
			expect((await impatient(root).readChanges(db)).map((change) => change.id)).toEqual(["one"]);
		});
	});

	// Root writes a file whatever its mark says (a Docker CI runs as root): there the mark cannot be tried.
	it.skipIf(process.getuid?.() === 0)(
		"12-4 a schema file marked read-only is not written, though a file moved over it would go around the mark",
		async () => {
			const root = await checkout();
			const files = schemaFilesAt(root);
			const schemaPath = path.join(root, "monti.schema.ts");
			await writeFile(schemaPath, "// read-only\n");
			await chmod(schemaPath, 0o444);
			await expect(files.write(db, schema, { id: "one", steps: [] }, true)).rejects.toMatchObject({ code: "EACCES" });
			expect(await readFile(schemaPath, "utf8")).toBe("// read-only\n");
			expect(await changesOf(root)).toEqual([]);
		},
	);
});
