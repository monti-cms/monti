import { access, mkdir, mkdtemp, readdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { sql } from "kysely";
import { beforeEach, describe, expect, it } from "vitest";
import { signedInApi } from "../__test__/admin";
import { testDatabase } from "../__test__/database";
import { runCli } from "../entry/cli";
import { agentTools, callAgentTool } from "../entry/tools";
import { createMonti } from "../monti";
import { addressesBefore, canMoveAddresses, MOVED_PATHS_LIMIT, movedAddresses } from "../schema/addresses";
import { migrateContent, readSchemaState } from "../schema/apply";
import { checkSchema, defineSchema, MAX_COLLECTION_NAME, MAX_FIELD_NAME, type Schema } from "../schema/define";
import { type FileCalls, schemaFilesAt } from "../schema/files";
import { schemaHash } from "../schema/plan";
import { syncSchemaFile } from "../schema/sync";

const db = await testDatabase();

const base = defineSchema({
	locales: {
		source: "ko",
		list: [
			{ code: "ko", name: "한국어" },
			{ code: "en", name: "English" },
		],
		prefix: "exceptSource",
	},
	collections: {
		post: {
			kind: "document",
			path: "/posts/:slug",
			fields: {
				title: { kind: "text", required: true },
				slug: { kind: "slug", required: true },
				summary: { kind: "text" },
				subtitle: { kind: "text" },
			},
		},
	},
});
const { title, slug, summary } = base.collections.post.fields;
const postWith = (fields: Schema["collections"][string]["fields"]): Schema["collections"] => ({
	post: { ...base.collections.post, fields },
});
/** `summary` renamed to `excerpt`, `subtitle` removed. */
const edited = postWith({ title, slug, excerpt: summary });
const renames = [{ collection: "post", from: "summary", to: "excerpt" }];
const answers = {
	"renameField:post.summary": { do: "renameField", values: "move" },
	"removeField:post.subtitle": { do: "removeField", values: "clear" },
} as const;

let root: string;
/**
 * The dev server's files, with a way to make a write fail that does not depend on who runs the tests (a file marked read-only is still written by
 * root, as in a Docker CI): the schema file cannot be moved into place, or the changes folder cannot be made.
 */
const locked = { schema: false, changes: false };
const refused = (what: string) => Object.assign(new Error(`EACCES: permission denied, ${what}`), { code: "EACCES" });
const io: FileCalls = {
	access,
	readdir,
	readFile,
	rm,
	writeFile,
	mkdir: ((...args: Parameters<typeof mkdir>) =>
		locked.changes ? Promise.reject(refused("monti/changes")) : mkdir(...args)) as typeof mkdir,
	rename: (from, to) =>
		locked.schema && String(to).endsWith("monti.schema.ts")
			? Promise.reject(refused("monti.schema.ts"))
			: rename(from, to),
};
const files = () => schemaFilesAt(root, "monti.schema.ts", io);
const dev = (schema: Schema = base) => createMonti({ db, schema, files: files() });
const live = (schema: Schema = base) => createMonti({ db, schema, files: null });
type Monti = ReturnType<typeof createMonti>;

type Read = {
	site: { name: string; writing: string; version: number };
	admin: { language: string | null; templates: boolean; version: number };
	schema: Schema;
	hash: string;
	version: number;
	adminValues: Record<string, { label?: string; version: number }>;
	locked: boolean;
	places: { value: string; where: "database" | "file"; locked: boolean }[];
	failedChange: string | null;
};
type Saved = {
	activityId: string;
	output: {
		site: boolean;
		adminValues: string[];
		structure: { changeId: string; written: boolean; applied: boolean } | null;
	};
};
const read = (monti: Monti) => monti.run("settings.read", {}, { actor: "admin" }) as Promise<Read>;
const save = (monti: Monti, input: unknown, versions?: Record<string, number>) =>
	monti.run("settings.save", input, { actor: "admin", versions }) as Promise<Saved>;
const post = (name: string, input: unknown) =>
	new Request(`https://site.test/api/operations/${name}`, { method: "POST", body: JSON.stringify({ input }) });

const settingsRows = async () =>
	Object.fromEntries(
		(await db.selectFrom("monti_settings").select(["id", "values"]).execute()).map((row) => [row.id, row.values]),
	);
const postValues = async () =>
	(await db.selectFrom("collection_admin_values").select("values").where("collection", "=", "post").executeTakeFirst())
		?.values;
const schemaFile = () => readFile(path.join(root, "monti.schema.ts"), "utf8").catch(() => null);
const changeFiles = () => readdir(path.join(root, "monti", "changes")).catch(() => [] as string[]);

beforeEach(async () => {
	locked.schema = false;
	locked.changes = false;
	root = await mkdtemp(path.join(tmpdir(), "monti-settings-"));
	await sql`drop view if exists monti_post`.execute(db);
	for (const table of [
		"entries",
		"schema_state",
		"schema_changes",
		"collection_admin_values",
		"monti_settings",
		"monti_proposal",
		"monti_delivery",
		"monti_activity",
	] as const)
		await db.deleteFrom(table).execute();
	await migrateContent(db, base, []);
});

describe("reading the settings", () => {
	it("12-1 settings.read gives the four tabs' values, where each lives, whether it is locked, the file's hash and the versions", async () => {
		const settings = await read(dev());
		expect(settings.site).toEqual({ name: "", writing: "", version: 0 });
		expect(settings.admin).toEqual({ language: null, templates: true, version: 0 });
		expect(settings.schema).toEqual(base);
		expect(settings.hash).toBe(schemaHash(base));
		expect(settings.locked).toBe(false);
		expect(settings.places).toContainEqual({ value: "site.name", where: "database", locked: false });
		expect(settings.places).toContainEqual({ value: "locales.list", where: "file", locked: false });

		const onLive = await read(live());
		expect(onLive.locked).toBe(true);
		// Only what lives in the file is locked there.
		expect(onLive.places.filter((place) => place.locked).map((place) => place.where)).toEqual(
			onLive.places.filter((place) => place.where === "file").map(() => "file"),
		);
		expect(onLive.places).toContainEqual({ value: "site.name", where: "database", locked: false });
	});

	it("12-1 the sign-in screen gets the site's name and the admin's language with auth.state, before anyone is signed in", async () => {
		const monti = dev();
		type State = { site: { name: string | null; language: string | null; templates: boolean } };
		expect(((await monti.run("auth.state", {}, { actor: "admin" })) as State).site).toEqual({
			name: null,
			language: null,
			templates: true,
		});
		await save(monti, { site: { name: "example.dev" } });
		await monti.run("admin.setPreference", { language: "en" }, { actor: "admin" });
		expect(((await monti.run("auth.state", {}, { actor: "admin" })) as State).site).toEqual({
			name: "example.dev",
			language: "en",
			templates: true,
		});
	});
});

describe("one save, each value in its one place", () => {
	it("12-2 an admin value goes to the database and leaves the schema file alone", async () => {
		const monti = dev();
		const saved = await save(monti, { site: { name: "example.dev", writing: "Short sentences." } });
		expect(saved.output).toEqual({ site: true, adminValues: [], structure: null });
		expect(await settingsRows()).toEqual({ site: { name: "example.dev", writing: "Short sentences." } });
		expect(await schemaFile()).toBeNull();
		expect(await changeFiles()).toEqual([]);
		expect((await read(monti)).site).toEqual({ name: "example.dev", writing: "Short sentences.", version: 1 });

		// One value saved leaves the other as it was; an emptied one is unset.
		await save(monti, { site: { name: "" } });
		expect(await settingsRows()).toEqual({ site: { writing: "Short sentences." } });
	});

	it("12-2 a structure value goes to the schema file and its change file, and no settings row holds it", async () => {
		const monti = dev();
		const locales = { ...base.locales, prefix: "always" as const };
		const saved = await save(monti, { locales });
		expect(saved.output.structure).toMatchObject({ written: true, applied: true });
		expect(await schemaFile()).toContain('prefix: "always"');
		expect(await changeFiles()).toHaveLength(1);
		expect(await settingsRows()).toEqual({});
		expect(monti.site.schema().locales.prefix).toBe("always");
		expect((await readSchemaState(db))?.schema.locales.prefix).toBe("always");
	});

	it("12-2 one save with both writes each side once: the name to the database, the languages and collections to the file", async () => {
		const monti = dev();
		const locales = { ...base.locales, list: [...base.locales.list, { code: "ja", name: "日本語" }] };
		const saved = await save(monti, {
			site: { name: "example.dev" },
			locales,
			collections: edited,
			renames,
			answers,
			adminValues: { post: { label: "글", fields: { excerpt: { label: "요약" } } } },
		});
		expect(saved.output).toMatchObject({ site: true, adminValues: ["post"], structure: { applied: true } });
		expect(await settingsRows()).toEqual({ site: { name: "example.dev" } });
		expect(await postValues()).toEqual({ label: "글", fields: { excerpt: { label: "요약" } } });
		const file = await schemaFile();
		expect(file).toContain("excerpt");
		expect(file).toContain('"ja"');
		expect(file).not.toContain("example.dev");
		expect(file).not.toContain("요약");
		expect((await readSchemaState(db))?.schema).toEqual({ locales, collections: edited });
	});

	it("12-2 a save that names the structure as it is writes no file", async () => {
		const monti = dev();
		const saved = await save(monti, { site: { name: "example.dev" }, locales: base.locales });
		expect(saved.output.structure).toBeNull();
		expect(await changeFiles()).toEqual([]);
	});

	it("12-2 a removed language still needs the review's answer, and deletes its translations with it", async () => {
		const monti = dev();
		const locales = { ...base.locales, list: [base.locales.list[0]] };
		await expect(save(monti, { locales })).rejects.toMatchObject({ reason: { key: "schema.choicesMissing" } });
		const saved = await save(monti, {
			locales,
			answers: { "removeLocale:en": { do: "removeLocale", confirm: true } },
		});
		expect(saved.output.structure).toMatchObject({ applied: true });
		expect(monti.site.schema().locales.list.map((locale) => locale.code)).toEqual(["ko"]);
	});

	it("12-2 admin.setPreference saves the admin's language and feature switches at once, each beside the other", async () => {
		const monti = dev();
		await monti.run("admin.setPreference", { language: "en" }, { actor: "admin" });
		await monti.run("admin.setPreference", { templates: false }, { actor: "admin" });
		expect(await settingsRows()).toEqual({ admin: { language: "en", templates: false } });
		expect((await read(monti)).admin).toEqual({ language: "en", templates: false, version: 2 });
		await expect(monti.run("admin.setPreference", {}, { actor: "admin" })).rejects.toThrow("Invalid input");
	});

	it("12-2 a save made on values read before another save is a conflict, and writes nothing", async () => {
		const monti = dev();
		const before = await read(monti);
		await save(monti, { site: { name: "first" } });
		await expect(
			save(monti, { site: { name: "second" } }, { "settings:site": before.site.version }),
		).rejects.toMatchObject({ code: "conflict" });
		expect(await settingsRows()).toEqual({ site: { name: "first" } });
	});

	it("12-2 a save of admin values alone can be undone; one that changed structure cannot", async () => {
		const monti = dev();
		await save(monti, { site: { name: "first" } });
		const second = await save(monti, { site: { name: "second" } });
		await monti.run("activity.undo", { id: second.activityId }, { actor: "admin" });
		expect((await read(monti)).site.name).toBe("first");

		const structural = await save(monti, {
			site: { name: "third" },
			locales: { ...base.locales, prefix: "never" },
		});
		await expect(monti.run("activity.undo", { id: structural.activityId }, { actor: "admin" })).rejects.toMatchObject({
			reason: { key: "errors.notUndoable" },
		});
		expect((await read(monti)).site.name).toBe("third");
	});

	it("12-2 an assistant's settings.save is a proposal aimed at the settings: nothing is written until a person applies it", async () => {
		const monti = dev();
		const proposalId = await monti.proposals.create("c1", "rename the site");
		await callAgentTool(monti, "settings.save", { site: { name: "Proposed" } }, { conversationId: "c1", proposalId });
		expect(await settingsRows()).toEqual({});
		const pending = (await monti.run("proposals.forTarget", { kind: "settings", id: "site" }, { actor: "admin" })) as {
			operation: string;
		}[];
		expect(pending.map((item) => item.operation)).toEqual(["settings.save"]);
		const [item] = await monti.proposals.apply(proposalId);
		expect(item.state).toBe("applied");
		expect(await settingsRows()).toEqual({ site: { name: "Proposed" } });
	});
});

describe("the live site", () => {
	const structure = [
		{ locales: { ...base.locales, prefix: "always" } },
		{ collections: edited, renames, answers },
		// Named as it is: still refused. On the live site no entry point takes a structure value at all.
		{ locales: base.locales },
	];

	it("12-3 settings.save with a structure value is refused whole on the live site, by the admin API, a command and the assistant", async () => {
		const monti = live();
		for (const input of structure) {
			const withName = { site: { name: "example.dev" }, ...input };
			const response = await signedInApi(monti)(post("settings.save", withName));
			expect(response.status).toBe(403);
			expect(await response.json()).toMatchObject({ reason: { key: "errors.structureLocked" } });

			const err: string[] = [];
			const code = await runCli(monti, ["settings.save", "--input", JSON.stringify(withName)], {
				out: () => {},
				err: (line) => err.push(line),
			});
			expect(code).toBe(1);
			expect(err.join()).toContain("forbidden");

			// The assistant cannot even propose it: the check runs when the proposal is made.
			const proposalId = await monti.proposals.create("c1", "change the structure");
			await expect(
				callAgentTool(monti, "settings.save", withName, { conversationId: "c1", proposalId }),
			).rejects.toThrow("Not allowed");
		}
		// Nothing of the refused saves stayed, not even the admin value sent with them.
		expect(await settingsRows()).toEqual({});
		expect((await readSchemaState(db))?.schema).toEqual(base);
		expect(monti.site.schema()).toEqual(base);
		expect(await changeFiles()).toEqual([]);
	});

	it("12-3 admin values are still saved on the live site, and the assistant can propose them", async () => {
		const monti = live();
		const saved = await save(monti, {
			site: { name: "example.dev" },
			adminValues: { post: { label: "글" } },
		});
		expect(saved.output).toEqual({ site: true, adminValues: ["post"], structure: null });
		expect(await postValues()).toEqual({ label: "글" });
		await monti.run("admin.setPreference", { templates: false }, { actor: "admin" });
		expect((await read(monti)).admin.templates).toBe(false);

		const proposalId = await monti.proposals.create("c1", "rename the site");
		await callAgentTool(monti, "settings.save", { site: { name: "Proposed" } }, { conversationId: "c1", proposalId });
		expect((await monti.proposals.apply(proposalId))[0].state).toBe("applied");
	});

	it("12-3 the structure operations the settings screen saves through are not offered on the live site either", async () => {
		const monti = live();
		for (const [name, input] of [
			["schema.apply", { draft: { ...base, collections: edited }, renames, answers }],
			["locales.apply", { locales: { ...base.locales, prefix: "always" } }],
			["schema.retry", {}],
		] as const) {
			const response = await signedInApi(monti)(post(name, input));
			expect(response.status, name).toBe(403);
		}
		expect((await readSchemaState(db))?.schema).toEqual(base);
	});
});

describe("when the structure side fails", () => {
	const labelled = {
		site: { name: "example.dev" },
		collections: edited,
		renames,
		answers,
		adminValues: {
			post: {
				label: "글",
				fields: { excerpt: { label: "요약" } },
				layout: [{ tab: "기본", fields: ["title", "excerpt"] }],
			},
		},
	};

	it("12-4 when the schema file cannot be written, the admin values are saved and the structure stays as it was", async () => {
		await db
			.insertInto("collection_admin_values")
			.values({ collection: "post", values: JSON.stringify({ fields: { subtitle: { label: "부제" } } }) })
			.execute();
		await writeFile(path.join(root, "monti.schema.ts"), "// read-only\n");
		locked.schema = true;
		const monti = dev();

		const saved = await save(monti, labelled);
		expect(saved.output).toMatchObject({ site: true, adminValues: ["post"], structure: { written: false } });
		expect((await read(monti)).site.name).toBe("example.dev");
		// The collection's admin values are saved under the names the structure still has: the renamed field's label under its old name,
		// and the field that was on its way out keeps its own.
		expect(await postValues()).toEqual({
			label: "글",
			fields: { summary: { label: "요약" }, subtitle: { label: "부제" } },
			layout: [{ tab: "기본", fields: ["title", "summary"] }],
		});
		expect(monti.site.schema()).toEqual(base);
		expect((await readSchemaState(db))?.schema).toEqual(base);
		expect(await schemaFile()).toBe("// read-only\n");
		expect(await changeFiles()).toEqual([]);

		// Once the file can be written, the same save goes through, and the values follow the rename.
		locked.schema = false;
		expect((await save(monti, labelled)).output.structure).toMatchObject({ written: true, applied: true });
		expect(await postValues()).toEqual(labelled.adminValues.post);
	});

	it("12-4 when the database step fails, the files and the admin values stay saved, and schema.retry finishes it", async () => {
		await db
			.insertInto("entries")
			.values({
				id: "e1",
				collection: "post",
				translation_group: "g1",
				locale: "ko",
				slug: "first",
				values: JSON.stringify({ summary: "first" }),
			})
			.execute();
		await sql`create function refuse() returns trigger language plpgsql as $$ begin raise exception 'refused'; end $$`.execute(
			db,
		);
		await sql`create trigger refuse before update on entries for each row execute function refuse()`.execute(db);
		const monti = dev();
		const saved = await save(monti, labelled);
		expect(saved.output.structure).toMatchObject({ written: true, applied: false });
		expect(await changeFiles()).toEqual([`${saved.output.structure?.changeId}.json`]);
		const failed = await read(monti);
		expect(failed.failedChange).toBe(saved.output.structure?.changeId);
		expect(failed.site.name).toBe("example.dev");
		expect((await postValues())?.label).toBe("글");

		await sql`drop trigger refuse on entries`.execute(db);
		await sql`drop function refuse`.execute(db);
		await monti.run("schema.retry", {}, { actor: "admin" });
		expect((await read(monti)).failedChange).toBeNull();
		expect(
			(await db.selectFrom("entries").select("values").where("id", "=", "e1").executeTakeFirstOrThrow()).values,
		).toEqual({ excerpt: "first" });
		// The retry moved the renamed field's label with it.
		expect(await postValues()).toMatchObject({ label: "글", fields: { excerpt: { label: "요약" } } });
	});

	it("12-4 schema.apply and locales.apply refuse, rather than crash, when the schema file cannot be written", async () => {
		await writeFile(path.join(root, "monti.schema.ts"), "// read-only\n");
		locked.schema = true;
		const monti = dev();
		await expect(
			monti.run("locales.apply", { locales: { ...base.locales, prefix: "always" } }, { actor: "admin" }),
		).rejects.toMatchObject({ reason: { key: "schema.notWritten" } });
		await expect(
			monti.run("schema.apply", { draft: { ...base, collections: edited }, renames, answers }, { actor: "admin" }),
		).rejects.toMatchObject({ reason: { key: "schema.notWritten" } });
		expect((await readSchemaState(db))?.schema).toEqual(base);
	});
});

describe("the plan of a language change", () => {
	it("12-1 locales.plan names a change of how addresses show the language, which touches no stored value", async () => {
		const plan = (await dev().run(
			"locales.plan",
			{ locales: { ...base.locales, prefix: "always" } },
			{ actor: "admin" },
		)) as { changes: { id: string; do: string; from?: string; to?: string; choices?: unknown }[] };
		expect(plan.changes).toEqual([{ id: "changePrefix", do: "changePrefix", from: "exceptSource", to: "always" }]);
	});
});

/** A post in the source language, published. */
async function publishedPost(monti: Monti, slug: string) {
	const made = (await monti.run(
		"entries.create",
		{ collection: "post", title: `글 ${slug}`, slug },
		{ actor: "admin" },
	)) as { output: { id: string } };
	await monti.run("entries.publish", { ids: [made.output.id] }, { actor: "admin" });
	return made.output.id;
}

/** A translation of `source` with a title of its own; published unless told to stay a draft. */
async function translation(monti: Monti, source: string, locale: string, publish = true) {
	const made = (await monti.run("translations.create", { source, locale }, { actor: "admin" })) as {
		output: { id: string };
	};
	const got = (await monti.run("entries.get", { id: made.output.id }, { actor: "admin" })) as {
		entry: { version: number };
	};
	await monti.run(
		"entries.save",
		{ id: made.output.id, version: got.entry.version, title: `Post in ${locale}` },
		{ actor: "admin" },
	);
	if (publish) await monti.run("entries.publish", { ids: [made.output.id] }, { actor: "admin" });
	return made.output.id;
}

const entriesIn = async (locale: string) =>
	(await db.selectFrom("entries").select("id").where("locale", "=", locale).execute()).map((row) => row.id);
const publishedIn = async (locale: string) =>
	(await db.selectFrom("entry_published").select("entry_id").where("locale", "=", locale).execute()).map(
		(row) => row.entry_id,
	);

describe("taking a language out", () => {
	it("12-1 a removed language takes its translations with it: the working copies and what the site shows", async () => {
		const monti = dev();
		const korean = await publishedPost(monti, "first");
		const english = await translation(monti, korean, "en");
		const draft = await translation(monti, await publishedPost(monti, "second"), "en", false);
		expect((await entriesIn("en")).sort()).toEqual([english, draft].sort());
		expect(await publishedIn("en")).toEqual([english]);

		await save(monti, {
			locales: { ...base.locales, list: [base.locales.list[0]] },
			answers: { "removeLocale:en": { do: "removeLocale", confirm: true } },
		});
		expect(await entriesIn("en")).toEqual([]);
		expect(await publishedIn("en")).toEqual([]);
		// The source stays, and stays on the site.
		expect(await publishedIn("ko")).toContain(korean);
	});

	const three: Schema = {
		...base,
		locales: { ...base.locales, list: [...base.locales.list, { code: "ja", name: "日本語" }] },
	};
	/** English the source, Korean (the source until now) taken out. */
	const englishFirst = {
		source: "en",
		list: [
			{ code: "en", name: "English" },
			{ code: "ja", name: "日本語" },
		],
		prefix: "exceptSource" as const,
	};

	it("12-1 a new source language and the old source taken out in one save: every group gets its draft in the new source before the old one leaves", async () => {
		await migrateContent(db, three, []);
		const monti = dev(three);
		const korean = await publishedPost(monti, "first");
		const japanese = await translation(monti, korean, "ja");
		expect(await entriesIn("en")).toEqual([]);

		// The plan promises one draft: the group has no English entry.
		const plan = (await monti.run("locales.plan", { locales: englishFirst }, { actor: "admin" })) as {
			changes: { do: string; count?: number }[];
		};
		expect(plan.changes.find((change) => change.do === "changeSource")?.count).toBe(1);

		const saved = await save(monti, {
			locales: englishFirst,
			answers: { "removeLocale:ko": { do: "removeLocale", confirm: true } },
		});
		expect(saved.output.structure).toMatchObject({ applied: true });
		// The draft the plan promised is there, made from the Korean entry before it left; the Japanese translation stays.
		const english = await db.selectFrom("entries").select(["title", "status"]).where("locale", "=", "en").execute();
		expect(english).toEqual([{ title: "글 first", status: "draft" }]);
		expect(await entriesIn("ja")).toEqual([japanese]);
		expect(await entriesIn("ko")).toEqual([]);
		// The change file says it in that order, so the live database follows it the same way.
		const [name] = await changeFiles();
		const change = JSON.parse(await readFile(path.join(root, "monti", "changes", String(name)), "utf8")) as {
			steps: { do: string }[];
		};
		expect(change.steps.map((step) => step.do)).toEqual(["changeSource", "removeLocale"]);
	});
});

describe("two saves over each other", () => {
	it("12-2 a collection's first admin values are saved on a version too: a second first save made on the same read is a conflict, not an overwrite", async () => {
		const monti = dev();
		// No row yet: the absent values are at version 0, and that is the version both tabs read.
		expect((await read(monti)).adminValues.post).toBeUndefined();
		const absent = { "collectionAdminValues:post": 0 };
		await save(monti, { adminValues: { post: { label: "글" } } }, absent);
		await expect(save(monti, { adminValues: { post: { folders: true } } }, absent)).rejects.toMatchObject({
			code: "conflict",
		});
		expect(await postValues()).toEqual({ label: "글" });
		// The other ways to write a collection's admin values hold the same version.
		await expect(
			monti.run(
				"collections.updateAdminValues",
				{ collection: "post", values: { folders: true } },
				{ actor: "admin", versions: absent },
			),
		).rejects.toMatchObject({ code: "conflict" });
		expect((await read(monti)).adminValues.post?.version).toBe(1);
	});
});

describe("names the core keeps", () => {
	it("12-2 no collection can take the name of a core table its read view would collide with", async () => {
		const { rows } = await sql<{ name: string }>`select table_name as name from information_schema.tables
			where table_schema = current_schema() and table_type = 'BASE TABLE' and table_name like 'monti\\_%'`.execute(db);
		expect(rows.map((row) => row.name)).toContain("monti_settings");
		const named = (name: string): Schema => ({
			...base,
			collections: { ...base.collections, [name]: { ...base.collections.post, path: `/${name}/:slug` } },
		});
		const problems = async (name: string) =>
			(await dev().run("schema.check", { draft: named(name) }, { actor: "admin" })) as { code: string }[];
		// A collection's view is `monti_<collection>`: every core table whose name is one a collection could have is refused.
		for (const { name } of rows) {
			const collection = name.slice("monti_".length);
			if (!/^[a-z][a-zA-Z0-9]*$/.test(collection)) continue;
			expect(await problems(collection), collection).toContainEqual({ collection, code: "reserved" });
		}
		// So it never reaches the files: a save that names one writes nothing.
		await expect(save(dev(), { collections: named("settings").collections })).rejects.toMatchObject({
			reason: { key: "schema.hasProblems" },
		});
		expect(await changeFiles()).toEqual([]);
		expect(await schemaFile()).toBeNull();
	});
});

describe("when the two files cannot both be written", () => {
	it("12-4 when the change file cannot be written the schema file is left as it was, and the save says nothing was written", async () => {
		await writeFile(path.join(root, "monti.schema.ts"), "// as it was\n");
		locked.changes = true;
		const monti = dev();
		const saved = await save(monti, { site: { name: "example.dev" }, locales: { ...base.locales, prefix: "always" } });
		expect(saved.output.structure).toMatchObject({ written: false, applied: false });
		// "Nothing written" is true of both files: the schema file was not changed on the way to the change file that failed.
		expect(await schemaFile()).toBe("// as it was\n");
		expect(await changeFiles()).toEqual([]);
		expect(monti.site.schema()).toEqual(base);
		expect((await read(monti)).failedChange).toBeNull();
		expect((await read(monti)).site.name).toBe("example.dev");
	});
});

describe("undoing a save that named the structure and left it as it was", () => {
	it("12-2 a save that names the structure unchanged beside a new name is undone like any save of admin values", async () => {
		const monti = dev();
		await save(monti, { site: { name: "first" } });
		const second = await save(monti, { site: { name: "second" }, locales: base.locales });
		expect(second.output.structure).toBeNull();
		await monti.run("activity.undo", { id: second.activityId }, { actor: "admin" });
		expect((await read(monti)).site.name).toBe("first");
	});

	it("12-4 a save whose schema file could not be written is undone too: the admin values it saved go back", async () => {
		await writeFile(path.join(root, "monti.schema.ts"), "// read-only\n");
		locked.schema = true;
		const monti = dev();
		await save(monti, { site: { name: "first" }, adminValues: { post: { label: "첫 이름" } } });
		const failed = await save(monti, {
			site: { name: "second" },
			collections: edited,
			renames,
			answers,
			adminValues: { post: { label: "글" } },
		});
		expect(failed.output.structure).toMatchObject({ written: false });
		expect((await read(monti)).site.name).toBe("second");
		await monti.run("activity.undo", { id: failed.activityId }, { actor: "admin" });
		expect((await read(monti)).site.name).toBe("first");
		expect(await postValues()).toEqual({ label: "첫 이름" });
	});
});

describe("what a structure change tells the site", () => {
	type Sent = { type: string; ids: string[]; paths?: string[] };
	const withReceiver = (schema: Schema = base) => {
		const sent: Sent[] = [];
		const monti = createMonti({
			db,
			schema,
			files: files(),
			receivers: [{ destination: "test", send: async (event) => void sent.push(event) }],
		});
		return { monti, sent, of: (type: string) => sent.filter((event) => event.type === type) };
	};

	it("12-2 a change of the language mark sends schema.applied with the old and the new address of every published entry it moved", async () => {
		const { monti, of } = withReceiver();
		const korean = await publishedPost(monti, "first");
		await translation(monti, korean, "en");
		// A draft has no address on the site: it is in no event.
		await monti.run("entries.create", { collection: "post", title: "초안", slug: "draft" }, { actor: "admin" });

		const saved = await save(monti, { locales: { ...base.locales, prefix: "always" } });
		// The source's address gains its language; the translation's had it already and did not move.
		expect(of("schema.applied")).toEqual([
			{
				type: "schema.applied",
				ids: [saved.output.structure?.changeId],
				paths: ["/ko/posts/first", "/posts/first"],
			},
		]);
	});

	it("12-2 a language taken out sends the addresses its pages had; a collection's path change sends both", async () => {
		const { monti, of } = withReceiver();
		const korean = await publishedPost(monti, "first");
		await translation(monti, korean, "en");
		await save(monti, {
			locales: { ...base.locales, list: [base.locales.list[0]] },
			answers: { "removeLocale:en": { do: "removeLocale", confirm: true } },
		});
		expect(of("schema.applied").at(-1)?.paths).toEqual(["/en/posts/first"]);
		await save(monti, { collections: { post: { ...base.collections.post, path: "/blog/:slug" } } });
		expect(of("schema.applied").at(-1)?.paths).toEqual(["/blog/first", "/posts/first"]);
	});

	it("12-4 a change whose database step failed sends nothing until schema.retry applies it, and then the addresses it moved", async () => {
		const { monti, of } = withReceiver();
		await publishedPost(monti, "first");
		await sql`create function refuse() returns trigger language plpgsql as $$ begin raise exception 'refused'; end $$`.execute(
			db,
		);
		await sql`create trigger refuse before insert on schema_changes for each row execute function refuse()`.execute(db);
		const saved = await save(monti, { locales: { ...base.locales, prefix: "always" } });
		expect(saved.output.structure).toMatchObject({ written: true, applied: false });
		expect(of("schema.applied")).toEqual([]);

		await sql`drop trigger refuse on schema_changes`.execute(db);
		await sql`drop function refuse`.execute(db);
		await monti.run("schema.retry", {}, { actor: "admin" });
		expect(of("schema.applied")).toEqual([
			{
				type: "schema.applied",
				ids: [saved.output.structure?.changeId],
				paths: ["/ko/posts/first", "/posts/first"],
			},
		]);
	});

	it("12-2 a save of admin values sends settings.saved with what it wrote and no address", async () => {
		const { monti, of } = withReceiver();
		await save(monti, { site: { name: "example.dev" }, adminValues: { post: { label: "글" } } });
		expect(of("settings.saved")).toEqual([{ type: "settings.saved", ids: ["site", "post"] }]);
		expect(of("schema.applied")).toEqual([]);
	});
});

describe("proposals a person took into the settings' draft", () => {
	const propose = async (monti: Monti, name: string, input: unknown) => {
		const proposalId = await monti.proposals.create("c1", "change the settings");
		return (await monti.proposals.add(proposalId, name, input)).itemId;
	};
	const pending = async (monti: Monti, also: { kind: string; id: string }[] = []) =>
		(
			(await monti.run("proposals.forTarget", { kind: "settings", id: "site", also }, { actor: "admin" })) as {
				id: string;
			}[]
		).map((item) => item.id);

	it("12-2 a proposal taken and put back in part is saved with the part that is kept", async () => {
		const monti = dev();
		const item = await propose(monti, "settings.save", {
			site: { name: "Proposed" },
			locales: { ...base.locales, prefix: "always" },
		});
		// The person took it, then put the name back: the save sends the languages alone, with the item it came from.
		const saved = (await monti.run(
			"settings.save",
			{ locales: { ...base.locales, prefix: "always" } },
			{ actor: "admin", accepted: [item] },
		)) as Saved;
		expect(saved.output.structure).toMatchObject({ written: true, applied: true });
		expect((await readSchemaState(db))?.schema.locales.prefix).toBe("always");
		expect((await read(monti)).site.name).toBe("");
		expect(await pending(monti)).toEqual([]);
		const row = await db
			.selectFrom("monti_proposal_item")
			.select(["state", "activity_id"])
			.where("id", "=", item)
			.executeTakeFirstOrThrow();
		expect(row).toEqual({ state: "applied", activity_id: saved.activityId });
	});

	it("12-2 an accepted item aimed at none of the save's records refuses it before a file is written", async () => {
		const monti = dev();
		// A proposal for a collection's name: no part of it is in a save of the languages.
		const item = await propose(monti, "collections.updateAdminValues", { collection: "post", values: { label: "글" } });
		await expect(
			monti.run(
				"settings.save",
				{ locales: { ...base.locales, prefix: "always" } },
				{ actor: "admin", accepted: [item] },
			),
		).rejects.toMatchObject({ reason: { key: "proposals.wrongTarget" } });
		// Refused whole: no file, the running schema and the database as they were, no activity.
		expect(await changeFiles()).toEqual([]);
		expect(await schemaFile()).toBeNull();
		expect(monti.site.schema()).toEqual(base);
		expect((await readSchemaState(db))?.schema).toEqual(base);
		expect(
			await db.selectFrom("monti_activity").select("id").where("operation", "=", "settings.save").execute(),
		).toEqual([]);
	});

	it("12-1 proposals.forTarget lists the items aimed at any of the records a screen shows, each once; a collection without admin values yet has a record to aim at", async () => {
		const monti = dev();
		const label = await propose(monti, "collections.updateAdminValues", {
			collection: "post",
			values: { label: "글" },
		});
		const both = await propose(monti, "settings.save", {
			site: { name: "Proposed" },
			adminValues: { post: { label: "게시글" } },
		});
		expect(await pending(monti)).toEqual([both]);
		expect(await pending(monti, [{ kind: "collectionAdminValues", id: "post" }])).toEqual([label, both]);
	});
});

describe("a source change beside a change of fields", () => {
	/** English the source; the list as it was. */
	const englishSource = { ...base.locales, source: "en" };
	const postWithValues = async (monti: Monti, values: Record<string, unknown>) => {
		const made = (await monti.run(
			"entries.create",
			{ collection: "post", title: "글", slug: "first", values },
			{ actor: "admin" },
		)) as { output: { id: string } };
		await monti.run("entries.publish", { ids: [made.output.id] }, { actor: "admin" });
	};
	const englishValues = async () =>
		(await db.selectFrom("entries").select("values").where("locale", "=", "en").executeTakeFirstOrThrow()).values;

	it("12-1 a field renamed in the save that changes the source: the new source is made with the value under its new name", async () => {
		const monti = dev();
		await postWithValues(monti, { summary: "요약" });
		const saved = await save(monti, { locales: englishSource, collections: edited, renames, answers });
		expect(saved.output.structure).toMatchObject({ applied: true });
		// `summary` is the same in every language, so it is read from the source: the English draft has it, as `excerpt`.
		expect(await englishValues()).toEqual({ excerpt: "요약" });
		const [name] = await changeFiles();
		const change = JSON.parse(await readFile(path.join(root, "monti", "changes", String(name)), "utf8")) as {
			steps: { do: string }[];
		};
		// The fields first, then the source: the order the live database follows too.
		expect(change.steps.map((step) => step.do)).toEqual(["renameField", "removeField", "changeSource"]);
	});

	it("12-1 a field removed with its values moved to another, in the save that changes the source: the new source has the moved value", async () => {
		const monti = dev();
		await postWithValues(monti, { subtitle: "부제" });
		const saved = await save(monti, {
			locales: englishSource,
			collections: postWith({ title, slug, summary }),
			answers: { "removeField:post.subtitle": { do: "removeField", values: { move: "summary" } } },
		});
		expect(saved.output.structure).toMatchObject({ applied: true });
		expect(await englishValues()).toEqual({ summary: "부제" });
	});
});

describe("a taken proposal when nothing of it is written", () => {
	const proposeLanguages = async (monti: Monti) => {
		const proposalId = await monti.proposals.create("c1", "always show the language");
		return (await monti.proposals.add(proposalId, "locales.apply", { locales: { ...base.locales, prefix: "always" } }))
			.itemId;
	};
	const stateOf = async (item: string) =>
		(await db.selectFrom("monti_proposal_item").select("state").where("id", "=", item).executeTakeFirstOrThrow()).state;
	const activity = () =>
		db.selectFrom("monti_activity").select("id").where("operation", "=", "settings.save").execute();

	it("12-4 a save that could write nothing (its schema file refused, no admin value beside) is refused: no activity row, and the item stays pending", async () => {
		const monti = dev();
		const item = await proposeLanguages(monti);
		locked.schema = true;
		await expect(
			monti.run(
				"settings.save",
				{ locales: { ...base.locales, prefix: "always" } },
				{ actor: "admin", accepted: [item] },
			),
		).rejects.toMatchObject({ reason: { key: "schema.notWritten" } });
		expect(await stateOf(item)).toBe("pending");
		expect(await activity()).toEqual([]);
		// It is still there to take again once the file can be written.
		locked.schema = false;
		await monti.run(
			"settings.save",
			{ locales: { ...base.locales, prefix: "always" } },
			{ actor: "admin", accepted: [item] },
		);
		expect(await stateOf(item)).toBe("applied");
	});

	it("12-4 an item aimed at the schema alone stays pending when the save wrote only an admin value beside it", async () => {
		const monti = dev();
		const item = await proposeLanguages(monti);
		locked.schema = true;
		const saved = (await monti.run(
			"settings.save",
			{ site: { name: "example.dev" }, locales: { ...base.locales, prefix: "always" } },
			{ actor: "admin", accepted: [item] },
		)) as Saved;
		expect(saved.output).toMatchObject({ site: true, structure: { written: false } });
		// The name is saved and logged; the proposal's change of the languages was not written, so it is not applied.
		expect(await stateOf(item)).toBe("pending");
		expect(await activity()).toHaveLength(1);
	});

	it("12-2 a save that names only what is saved already is refused: nothing is written, logged or sent", async () => {
		const sent: { type: string }[] = [];
		const monti = createMonti({
			db,
			schema: base,
			files: files(),
			receivers: [{ destination: "test", send: async (event) => void sent.push(event) }],
		});
		await save(monti, { site: { name: "example.dev" }, adminValues: { post: { label: "글" } } });
		const before = await read(monti);
		sent.length = 0;
		for (const same of [
			{ site: {} },
			{ site: { name: "example.dev" } },
			{ adminValues: { post: { label: "글" } } },
			{ site: {}, locales: base.locales },
		])
			await expect(save(monti, same)).rejects.toMatchObject({ reason: { key: "settings.nothingToSave" } });
		expect(await read(monti)).toEqual(before);
		expect(await activity()).toHaveLength(1);
		expect(sent).toEqual([]);
		// Beside a real change, the unchanged side is neither written nor named in the event.
		await save(monti, { site: { name: "example.dev" }, adminValues: { post: { folders: true } } });
		expect(sent).toEqual([{ type: "settings.saved", ids: ["post"] }]);
		expect((await read(monti)).site.version).toBe(before.site.version);
	});
});

describe("a collection's admin values are changed by what is named", () => {
	const whole = {
		label: "게시글",
		folders: true,
		fields: { summary: { label: "요약", description: "한 문장" }, subtitle: { label: "부제" } },
		layout: [{ tab: "기본", fields: ["title", "summary", "subtitle"] }],
		editor: { blocks: ["paragraph"], marks: "all" as const, headings: [2] },
		list: { hidden: ["subtitle"], pageSize: 50 as const },
	};
	const update = (monti: Monti, values: unknown) =>
		monti.run("collections.updateAdminValues", { collection: "post", values }, { actor: "admin" });

	it("12-2 collections.updateAdminValues is a patch: a label alone leaves every other value as saved", async () => {
		const monti = dev();
		await update(monti, whole);
		await update(monti, { label: "글" });
		expect(await postValues()).toEqual({ ...whole, label: "글" });
	});

	it("12-2 a patch goes by field and by key, null clears, and settings.save's adminValues follow the same rule", async () => {
		const monti = dev();
		await update(monti, whole);
		await update(monti, { fields: { summary: { label: null }, subtitle: null, title: { label: "제목" } } });
		expect((await postValues())?.fields).toEqual({ summary: { description: "한 문장" }, title: { label: "제목" } });
		await update(monti, { editor: { headings: [2, 3] }, list: { pageSize: null } });
		expect(await postValues()).toMatchObject({
			editor: { blocks: ["paragraph"], marks: "all", headings: [2, 3] },
			list: { hidden: ["subtitle"] },
		});
		await save(monti, { adminValues: { post: { label: null, layout: null } } });
		const after = await postValues();
		expect(after).not.toHaveProperty("label");
		expect(after).not.toHaveProperty("layout");
		expect(after).toMatchObject({ folders: true, fields: { summary: { description: "한 문장" } } });
	});

	it("12-2 an assistant's proposal that names only a label, applied, changes only the label", async () => {
		const monti = dev();
		await update(monti, whole);
		const proposalId = await monti.proposals.create("c1", "call the posts 글");
		await callAgentTool(
			monti,
			"collections.updateAdminValues",
			{ collection: "post", values: { label: "글" } },
			{ conversationId: "c1", proposalId },
		);
		expect((await monti.proposals.apply(proposalId))[0]?.state).toBe("applied");
		expect(await postValues()).toEqual({ ...whole, label: "글" });
	});
});

describe("the admin's own preferences", () => {
	it("12-2 admin.setPreference is a person's: the assistant has no such tool and cannot propose it", async () => {
		const monti = dev();
		expect(agentTools(monti).map((tool) => tool.name)).not.toContain("admin.setPreference");
		expect(agentTools(monti).map((tool) => tool.name)).toContain("settings.save");
		const proposalId = await monti.proposals.create("c1", "switch to English");
		await expect(
			callAgentTool(monti, "admin.setPreference", { language: "en" }, { conversationId: "c1", proposalId }),
		).rejects.toThrow("Unknown operation");
		expect((await read(monti)).admin.language).toBeNull();
	});
});

describe("an event's list of moved addresses", () => {
	it("12-2 past the limit the event lists no address and says the whole site changed", async () => {
		const sent: { type: string; paths?: string[]; allPaths?: true }[] = [];
		const monti = createMonti({
			db,
			schema: base,
			files: files(),
			receivers: [{ destination: "test", send: async (event) => void sent.push(event) }],
		});
		// Each published entry that moves gives two addresses (old and new): one more entry than half the limit goes past it.
		const count = MOVED_PATHS_LIMIT / 2 + 1;
		await sql`insert into entries (id, collection, translation_group, locale, slug, title, values)
			select 'e' || n, 'post', 'g' || n, 'ko', 's' || n, 't', '{}'::jsonb from generate_series(1, ${count}::int) n`.execute(
			db,
		);
		await sql`insert into entry_published (entry_id, collection, locale, title, slug, values, published_at, from_version, block_hashes)
			select 'e' || n, 'post', 'ko', 't', 's' || n, '{}'::jsonb, now(), 1, '{}'::jsonb from generate_series(1, ${count}::int) n`.execute(
			db,
		);
		await save(monti, { locales: { ...base.locales, prefix: "always" } });
		const [applied] = sent.filter((event) => event.type === "schema.applied");
		expect(applied).toMatchObject({ type: "schema.applied", allPaths: true });
		expect(applied).not.toHaveProperty("paths");

		// One entry fewer moved (the mark taken off again from all but the limit's worth): the list is back.
		await sql`delete from entries where id = 'e1'`.execute(db);
		await save(monti, { locales: { ...base.locales, prefix: "never" } });
		const last = sent.filter((event) => event.type === "schema.applied").at(-1);
		expect(last?.paths).toHaveLength(MOVED_PATHS_LIMIT);
		expect(last).not.toHaveProperty("allPaths");
	});

	it("12-2 a change that can move no address reads none: a field added, a label, an added language", async () => {
		// Any read of the published entries would throw here.
		const unread = new Proxy({}, { get: () => () => Promise.reject(new Error("read")) }) as never;
		const withField: Schema = {
			...base,
			collections: postWith({ ...base.collections.post.fields, kicker: { kind: "text" } }),
		};
		const withLanguage: Schema = {
			...base,
			locales: { ...base.locales, list: [...base.locales.list, { code: "ja", name: "日本語" }] },
		};
		for (const after of [base, withField, withLanguage]) {
			expect(canMoveAddresses(base, after)).toBe(false);
			expect(await addressesBefore(unread, base, after)).toBeNull();
			expect(await movedAddresses(unread, null, after)).toEqual({ paths: [] });
		}
		// What can move one: the mark, a path, a language or a collection gone, the source where the mark depends on it.
		expect(canMoveAddresses(base, { ...base, locales: { ...base.locales, prefix: "always" } })).toBe(true);
		expect(canMoveAddresses(base, { ...base, locales: { ...base.locales, source: "en" } })).toBe(true);
		expect(canMoveAddresses(base, { ...base, locales: { ...base.locales, list: [base.locales.list[0]] } })).toBe(true);
		expect(canMoveAddresses(base, { ...base, collections: {} })).toBe(true);
		expect(
			canMoveAddresses(base, { ...base, collections: { post: { ...base.collections.post, path: "/blog/:slug" } } }),
		).toBe(true);
		const never: Schema = { ...base, locales: { ...base.locales, prefix: "never" } };
		expect(canMoveAddresses(never, { ...never, locales: { ...never.locales, source: "en" } })).toBe(false);
	});
});

describe("a write that fails after its files are written", () => {
	it("12-4 the database rolls back and the files stay: the change is recorded as saved and not applied, and schema.retry finishes it", async () => {
		const monti = dev();
		await monti.run(
			"entries.create",
			{ collection: "post", title: "글", slug: "first", values: { summary: "요약" } },
			{ actor: "admin" },
		);
		// The step after the structure is applied fails: the write's activity row.
		await sql`create function refuse() returns trigger language plpgsql as $$ begin
			if new.operation = 'settings.save' then raise exception 'refused'; end if; return new; end $$`.execute(db);
		await sql`create trigger refuse before insert on monti_activity for each row execute function refuse()`.execute(db);
		await expect(save(monti, { site: { name: "example.dev" }, collections: edited, renames, answers })).rejects.toThrow(
			"refused",
		);
		await sql`drop trigger refuse on monti_activity`.execute(db);
		await sql`drop function refuse`.execute(db);

		// Nothing of the write is in the database, and its files are on disk.
		const [name] = await changeFiles();
		expect(name).toBeDefined();
		expect(await schemaFile()).toContain("excerpt");
		const failed = await read(monti);
		expect(failed.site.name).toBe("");
		expect((await readSchemaState(db))?.schema).toEqual(base);
		// Recorded as "saved, not applied", not left to be read as a hand edit of the file.
		expect(failed.failedChange).toBe(String(name).replace(/\.json$/, ""));

		await monti.run("schema.retry", {}, { actor: "admin" });
		expect((await read(monti)).failedChange).toBeNull();
		expect((await readSchemaState(db))?.schema.collections).toEqual(edited);
		expect((await db.selectFrom("entries").select("values").executeTakeFirstOrThrow()).values).toEqual({
			excerpt: "요약",
		});
	});

	it("12-4 a change file a write left without its database step is applied at the next start, with its steps, not read back as a hand edit", async () => {
		const monti = dev();
		await monti.run(
			"entries.create",
			{ collection: "post", title: "글", slug: "first", values: { summary: "요약" } },
			{ actor: "admin" },
		);
		// The files of a rename, written whole; the server stopped before the database followed them.
		const draft: Schema = { ...base, collections: edited };
		await files().write(
			db,
			draft,
			{
				id: "2026-11-12-crashed",
				steps: [
					{ do: "renameField", collection: "post", from: "summary", to: "excerpt", values: "move" },
					{ do: "removeField", collection: "post", field: "subtitle", values: "clear" },
				],
			},
			true,
		);
		// The next start reads the new schema file.
		const restarted = dev(draft);
		expect(await syncSchemaFile(restarted)).toEqual({ status: "applied", changeId: "2026-11-12-crashed" });
		// The rename moved the value: read as a hand edit it would have been a removed field and a new one, waiting for a review.
		expect((await db.selectFrom("entries").select("values").executeTakeFirstOrThrow()).values).toEqual({
			excerpt: "요약",
		});
		expect((await read(restarted)).failedChange).toBeNull();
	});
});

describe("names Postgres would cut", () => {
	it("12-2 a collection or field name longer than the database keeps is a problem of the schema, before two long names become one view", () => {
		const long = (length: number) => `a${"b".repeat(length - 1)}`;
		const named = (collection: string, field: string): Schema => ({
			...base,
			collections: {
				[collection]: {
					...base.collections.post,
					fields: { ...base.collections.post.fields, [field]: { kind: "text" } },
				},
			},
		});
		expect(checkSchema(named(long(MAX_COLLECTION_NAME), long(MAX_FIELD_NAME)))).toEqual([]);
		expect(checkSchema(named(long(MAX_COLLECTION_NAME + 1), "kicker"))).toEqual([
			{ collection: long(MAX_COLLECTION_NAME + 1), code: "tooLong" },
		]);
		expect(checkSchema(named("post", long(MAX_FIELD_NAME + 1)))).toEqual([
			{ collection: "post", field: long(MAX_FIELD_NAME + 1), code: "tooLong" },
		]);
		// `monti_` and the name fit the 63 bytes Postgres keeps.
		expect(`monti_${long(MAX_COLLECTION_NAME)}`).toHaveLength(63);
	});
});

describe("a list's own look when a field is renamed or removed", () => {
	it("12-2 the column's place, whether it is hidden and the width it was dragged to follow a renamed field, and go with a removed one", async () => {
		const monti = dev();
		await monti.run(
			"list.savePrefs",
			{
				collection: "post",
				order: ["subtitle", "summary"],
				hidden: ["summary"],
				widths: { summary: 240, subtitle: 120 },
			},
			{ actor: "admin" },
		);
		// `summary` becomes `excerpt`, `subtitle` goes; the save names nothing of the list.
		await save(monti, { collections: edited, renames, answers });
		expect((await postValues())?.list).toEqual({ order: ["excerpt"], hidden: ["excerpt"], widths: { excerpt: 240 } });
	});
});

describe("a pending change and a hand edit made after it", () => {
	/** `summary` renamed to `excerpt`; `subtitle` still there. */
	const renamed: Schema = { ...base, collections: postWith({ title, slug, excerpt: summary, subtitle: summary }) };
	/** The same, with `subtitle` taken out of the file by hand afterwards. */
	const handEdited: Schema = { ...base, collections: edited };
	const pendingRename = async () => {
		const monti = dev();
		await monti.run(
			"entries.create",
			{ collection: "post", title: "글", slug: "first", values: { summary: "요약", subtitle: "부제" } },
			{ actor: "admin" },
		);
		// A reviewed rename, its files written; the database has not followed it yet.
		await files().write(
			db,
			renamed,
			{
				id: "2026-11-12-pending",
				steps: [{ do: "renameField", collection: "post", from: "summary", to: "excerpt", values: "move" }],
			},
			true,
		);
	};
	const values = async () => (await db.selectFrom("entries").select("values").executeTakeFirstOrThrow()).values;

	it("12-4 the start applies the pending change as the schema it was written for, and the field taken out by hand since still waits for its review", async () => {
		await pendingRename();
		const restarted = dev(handEdited);
		const result = await syncSchemaFile(restarted);
		// The removal was never reviewed: it has values to decide about, so it is not applied with the pending change.
		expect(result.status).toBe("review");
		expect(result).toMatchObject({
			changes: [{ id: "removeField:post.subtitle", do: "removeField", count: 1 }],
		});
		// The database follows the pending change's schema: the rename is done, the field removed by hand is still a field with its value.
		expect((await readSchemaState(db))?.schema).toEqual(renamed);
		expect(await values()).toEqual({ excerpt: "요약", subtitle: "부제" });
		const state = await read(restarted);
		expect(state.failedChange).toBeNull();
		expect((state as Read & { fileChanged: boolean }).fileChanged).toBe(true);
	});

	it("12-4 schema.retry records the schema its changes leave, not the schema file as it is by then", async () => {
		await pendingRename();
		const restarted = dev(handEdited);
		await restarted.run("schema.retry", {}, { actor: "admin" });
		expect((await readSchemaState(db))?.schema).toEqual(renamed);
		// The hand edit is planned against what the database follows, with its choice still to make.
		const plan = (await restarted.run("schema.plan", { draft: handEdited }, { actor: "admin" })) as {
			changes: { id: string; choices?: unknown[] }[];
		};
		expect(plan.changes.map((change) => change.id)).toEqual(["removeField:post.subtitle"]);
		expect(plan.changes[0]?.choices?.length).toBeGreaterThan(0);
	});
});

describe("a save while another process holds the schema files", () => {
	it("12-4 a structure save is refused whole, saying the files are in use, when they stay held past the wait: nothing of it is saved, and the same save goes through once they are free", async () => {
		// Another process is clearing what a crashed write left, and stands still in the middle of it: it holds the files.
		const changes = path.join(root, "monti", "changes");
		await mkdir(changes, { recursive: true });
		await writeFile(
			path.join(changes, "crashed.json.part"),
			JSON.stringify({ id: "crashed", steps: [], file: "0000000000000000" }),
		);
		let reached = () => {};
		const standing = new Promise<void>((resolve) => {
			reached = resolve;
		});
		let letGo = () => {};
		const released = new Promise<void>((resolve) => {
			letGo = resolve;
		});
		const other = schemaFilesAt(root, "monti.schema.ts", {
			...io,
			rm: (async (...args: Parameters<typeof rm>) => {
				reached();
				await released;
				return rm(...args);
			}) as typeof rm,
		});
		const recovering = other.readChanges(db);
		await standing;

		// This server waits a moment for the files, not the ten seconds of a real one.
		const monti = createMonti({ db, schema: base, files: schemaFilesAt(root, "monti.schema.ts", io, 100) });
		const input = { site: { name: "example.dev" }, collections: edited, renames, answers };
		await expect(save(monti, input)).rejects.toMatchObject({
			code: "check-failed",
			reason: { key: "schema.filesBusy" },
		});
		// Not "the file could not be written" with the admin values saved beside: the whole save is refused, and nothing was taken over.
		expect((await read(monti)).site.name).toBe("");
		expect(await schemaFile()).toBeNull();
		// The other process's mark and the part it is clearing: as they were.
		expect((await changeFiles()).map((name) => (name.startsWith(".owner.") ? "(mark)" : name))).toEqual([
			"(mark)",
			"crashed.json.part",
		]);
		expect(await db.selectFrom("monti_activity").select("id").execute()).toEqual([]);

		letGo();
		await recovering;
		const saved = await save(monti, input);
		expect(saved.output.structure).toMatchObject({ written: true, applied: true });
		expect((await read(monti)).site.name).toBe("example.dev");
		expect(await schemaFile()).toContain("excerpt");
	});
});

describe("two writes at the same moment", () => {
	const key = (record: string) => `monti:record:${record}`;
	/** Holds a record's lock, as a write that touches it does, until `release`. */
	const holding = async (record: string) => {
		let release = () => {};
		const gate = new Promise<void>((resolve) => {
			release = resolve;
		});
		let held = () => {};
		const taken = new Promise<void>((resolve) => {
			held = resolve;
		});
		const done = db.transaction().execute(async (trx) => {
			await sql`select pg_advisory_xact_lock(hashtext(${key(record)}))`.execute(trx);
			held();
			await gate;
		});
		await taken;
		return async () => {
			release();
			await done;
		};
	};
	/** How many writes wait for a record's lock right now. */
	const waitingFor = async (record: string) => {
		const { rows } = await sql<{ count: string }>`select count(*) as count from pg_locks
			where locktype = 'advisory' and not granted
				and objid::bigint = (hashtext(${key(record)})::bigint & 4294967295)`.execute(db);
		return Number(rows[0]?.count ?? 0);
	};
	const until = async (condition: () => Promise<boolean>) => {
		for (let tries = 0; tries < 400; tries++) {
			if (await condition()) return;
			await new Promise((resume) => setTimeout(resume, 10));
		}
		throw new Error("the writes never reached the moment the test waits for");
	};

	it("12-2 a save that names a value as it is saved holds that record too: a change made to it meanwhile is not written over", async () => {
		const monti = dev();
		await save(monti, { adminValues: { post: { label: "글" } } });
		// Save A names a new site name and the collection's label as it is. It is stopped at the site's record, after it decided what it holds.
		const releaseSite = await holding("settings:site");
		const a = save(monti, { site: { name: "새 이름" }, adminValues: { post: { label: "글" } } });
		await until(async () => (await waitingFor("settings:site")) > 0);
		// Save B changes that label. A holds the collection's record, so B waits its turn; without that B would be done before A goes on.
		let settled = false;
		const b = monti
			.run("collections.updateAdminValues", { collection: "post", values: { label: "다른 탭" } }, { actor: "admin" })
			.finally(() => {
				settled = true;
			});
		await until(async () => settled || (await waitingFor("collectionAdminValues:post")) > 0);
		await releaseSite();
		await Promise.all([a, b]);
		// Both saves are whole: A's name, B's label. A did not write the label it read back over B's.
		expect((await read(monti)).site.name).toBe("새 이름");
		expect(await postValues()).toEqual({ label: "다른 탭" });
	});

	it("12-2 a save made on an old read of a value it names as it is now is still a conflict: its version is compared, changed or not", async () => {
		const monti = dev();
		await save(monti, { adminValues: { post: { label: "글" } } });
		await save(monti, { adminValues: { post: { folders: true } } });
		// The label is what this save names, but it was read before the second save: the record moved on.
		await expect(
			save(
				monti,
				{ site: { name: "새 이름" }, adminValues: { post: { label: "글" } } },
				{ "collectionAdminValues:post": 1 },
			),
		).rejects.toMatchObject({ code: "conflict" });
		expect((await read(monti)).site.name).toBe("");
	});

	it("12-2 undoing a save that named a value as it is leaves that record alone: its version does not move", async () => {
		const monti = dev();
		await save(monti, { adminValues: { post: { label: "글" } } });
		const saved = await save(monti, { site: { name: "새 이름" }, adminValues: { post: { label: "글" } } });
		const before = (await read(monti)).adminValues.post?.version;
		await monti.run("activity.undo", { id: saved.activityId }, { actor: "admin" });
		expect((await read(monti)).site.name).toBe("");
		expect((await read(monti)).adminValues.post?.version).toBe(before);
	});

	it("12-2 a rename of a field and a list's saved look at the same moment: the structure change holds the collection's admin values, so the width saved meanwhile is kept", async () => {
		const monti = dev();
		const prefs = (widths: Record<string, number>) =>
			monti.run("list.savePrefs", { collection: "post", widths }, { actor: "admin" });
		await prefs({ summary: 120 });
		// The list's save is stopped after it wrote its row and before it ends: its activity row waits for a lock the test holds.
		await sql`create function gate() returns trigger language plpgsql as $$ begin
			if new.operation = 'list.savePrefs' then perform pg_advisory_xact_lock(424242); end if; return new; end $$`.execute(
			db,
		);
		await sql`create trigger gate before insert on monti_activity for each row execute function gate()`.execute(db);
		let open = () => {};
		const gate = new Promise<void>((resolve) => {
			open = resolve;
		});
		let closed = () => {};
		const shut = new Promise<void>((resolve) => {
			closed = resolve;
		});
		const holder = db.transaction().execute(async (trx) => {
			await sql`select pg_advisory_xact_lock(424242)`.execute(trx);
			closed();
			await gate;
		});
		await shut;
		const waitingAtGate = async () =>
			Number(
				(
					await sql<{ count: string }>`select count(*) as count from pg_locks
						where locktype = 'advisory' and not granted and objid = 424242 and classid = 0`.execute(db)
				).rows[0]?.count ?? 0,
			);
		const dragging = prefs({ summary: 320 });
		await until(async () => (await waitingAtGate()) > 0);

		// A rename of `summary`, with no admin value in the save: it moves the collection's admin values with the field.
		const renaming = save(monti, {
			collections: postWith({ title, slug, excerpt: summary, subtitle: summary }),
			renames,
			answers: { "renameField:post.summary": { do: "renameField", values: "move" } },
		});
		// It waits for the collection's record (which the list's save holds) before it reads the row. Without the hold it would read the
		// row as it was (120) and wait only to write it back.
		const blockedOnRow = async () =>
			Number(
				(
					await sql<{ count: string }>`select count(*) as count from pg_stat_activity
						where datname = current_database() and wait_event_type = 'Lock'
							and query ilike '%update%collection_admin_values%'`.execute(db)
				).rows[0]?.count ?? 0,
			);
		await until(async () => (await waitingFor("collectionAdminValues:post")) > 0 || (await blockedOnRow()) > 0);
		open();
		await holder;
		await Promise.all([dragging, renaming]);
		await sql`drop trigger gate on monti_activity`.execute(db);
		await sql`drop function gate`.execute(db);
		// The width dragged while the rename waited is the one the renamed field has.
		expect((await postValues())?.list).toEqual({ widths: { excerpt: 320 } });
	});
});
