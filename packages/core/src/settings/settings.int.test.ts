import { chmod, mkdir, mkdtemp, readdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { sql } from "kysely";
import { beforeEach, describe, expect, it } from "vitest";
import { signedInApi } from "../__test__/admin";
import { testDatabase } from "../__test__/database";
import { runCli } from "../entry/cli";
import { callAgentTool } from "../entry/tools";
import { createMonti } from "../monti";
import { migrateContent, readSchemaState } from "../schema/apply";
import { defineSchema, type Schema } from "../schema/define";
import { schemaFilesAt } from "../schema/files";
import { schemaHash } from "../schema/plan";

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
const dev = (schema: Schema = base) => createMonti({ db, schema, files: schemaFilesAt(root) });
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
		await chmod(path.join(root, "monti.schema.ts"), 0o444);
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
		await chmod(path.join(root, "monti.schema.ts"), 0o644);
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
		await chmod(path.join(root, "monti.schema.ts"), 0o444);
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
		await mkdir(path.join(root, "monti", "changes"), { recursive: true });
		await chmod(path.join(root, "monti", "changes"), 0o555);
		const monti = dev();
		const saved = await save(monti, { site: { name: "example.dev" }, locales: { ...base.locales, prefix: "always" } });
		await chmod(path.join(root, "monti", "changes"), 0o755);
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
		await chmod(path.join(root, "monti.schema.ts"), 0o444);
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
			files: schemaFilesAt(root),
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
		// A proposal for the admin's preferences: no part of it is in a save of the languages.
		const item = await propose(monti, "admin.setPreference", { templates: false });
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
