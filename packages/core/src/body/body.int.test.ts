import { sql } from "kysely";
import { beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { testDatabase } from "../__test__/database";
import { createReader } from "../entries/reader";
import { createMonti, definePlugin } from "../monti";
import { type CreateElement, renderDocument } from "../render";
import { migrateContent } from "../schema/apply";
import { defineSchema } from "../schema/define";
import { defineBlock } from "./blocks";
import type { Block, Doc } from "./doc";
import { entryLink } from "./links";

const db = await testDatabase();

const schema = defineSchema({
	collections: {
		post: {
			kind: "document",
			path: "/posts/:slug",
			fields: { title: { kind: "text", required: true }, slug: { kind: "slug", required: true } },
		},
	},
});

/** A tiny element factory that writes HTML, standing in for the site's React. */
type Component = (props: Record<string, unknown> & { children: string }) => string;
const html: CreateElement<string> = (type, props, ...children) => {
	const inner = children
		.flat()
		.filter((child) => child !== null && child !== undefined)
		.join("");
	if (typeof type === "function") return (type as Component)({ ...props, children: inner });
	const attrs = Object.entries(props ?? {})
		.filter(([name, value]) => name !== "key" && value !== undefined && value !== false)
		.map(([name, value]) => (value === true ? ` ${name}` : ` ${name}="${value}"`))
		.join("");
	return ["br", "hr", "img", "input"].includes(String(type))
		? `<${type}${attrs}/>`
		: `<${type}${attrs}>${inner}</${type}>`;
};
const draw = (body: Doc, options: Partial<Parameters<typeof renderDocument<string>>[1]> = {}) =>
	renderDocument(body, { createElement: html, ...options }).join("");

const Callout: Component = ({ attrs, children }) =>
	`<aside data-tone="${(attrs as { tone: string }).tone}">${children}</aside>`;
const callout = defineBlock({
	type: "callout",
	label: "콜아웃",
	description: "A highlighted box for notes and warnings.",
	menu: "insert",
	attrs: z.object({ tone: z.enum(["note", "warn"]) }),
	holds: "blocks",
	Site: Callout,
	check: (block) => (block.children?.length ? [] : [{ level: "block", message: "비어 있는 콜아웃" }]),
});
const site = () => createMonti({ db, schema, plugins: [definePlugin({ name: "callouts", blocks: [callout] })] });

type Written<Output> = { output: Output; activityId: string };
const write = async <Output = { id: string }>(name: string, input: unknown, monti = site()) =>
	(await monti.run(name, input, { actor: "admin" })) as Written<Output>;
const read = <Output>(name: string, input: unknown, monti = site()) =>
	monti.run(name, input, { actor: "admin" }) as Promise<Output>;
type Got = {
	entry: { version: number; doc: Doc | null };
	tasks: { code: string; block?: string; blocking: boolean }[];
};
const get = (id: string, monti = site()) => read<Got>("entries.get", { id }, monti);
const version = async (id: string) => (await get(id)).entry.version;

const p = (id: string, text: string, extra: Partial<Block> = {}): Block => ({
	id,
	type: "paragraph",
	content: [{ type: "text", text }],
	...extra,
});
const doc = (...blocks: Block[]): Doc => ({ type: "doc", blocks });

async function newPost(body: Doc) {
	return (await write("entries.create", { collection: "post", locale: "ko", title: "Hello", doc: body })).output.id;
}
const setEditor = (editor: object) =>
	write("collections.updateAdminValues", { collection: "post", values: { editor } });

beforeEach(async () => {
	await sql`drop view if exists monti_post`.execute(db);
	for (const table of [
		"entries",
		"templates",
		"collection_admin_values",
		"schema_state",
		"schema_changes",
		"monti_delivery",
		"monti_activity",
	] as const)
		await db.deleteFrom(table).execute();
	await migrateContent(db, schema, []);
});

describe("one definition", () => {
	it("03-1 a block defined once is in the catalog, drawn on the site and adds its own to-do rows", async () => {
		type Catalog = { blocks: { type: string; description: string; attrs: { properties?: object } | null }[] };
		const catalog = await read<Catalog>("blocks.catalog", { collection: "post" });
		expect(catalog.blocks.find((block) => block.type === "callout")).toMatchObject({
			description: "A highlighted box for notes and warnings.",
			attrs: { properties: { tone: { enum: ["note", "warn"] } } },
		});
		await setEditor({ blocks: ["paragraph"] });
		expect((await read<Catalog>("blocks.catalog", { collection: "post" })).blocks.map((block) => block.type)).toEqual([
			"paragraph",
		]);
		await setEditor({ blocks: "all" });

		const body = doc({ id: "b_1", type: "callout", attrs: { tone: "warn" }, children: [p("b_2", "Careful")] });
		expect(draw(body, { blocks: [callout] })).toBe('<aside data-tone="warn"><p>Careful</p></aside>');

		const id = await newPost(doc({ id: "b_1", type: "callout", attrs: { tone: "note" } }));
		expect((await get(id)).tasks).toEqual([expect.objectContaining({ code: "block", block: "b_1", blocking: true })]);
	});

	it("03-1 core blocks are drawn as plain HTML, and a block the site does not define is left out", () => {
		const body = doc(
			{ id: "b_1", type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Title" }] },
			{
				id: "b_2",
				type: "paragraph",
				content: [
					{ type: "text", text: "a " },
					{ type: "text", text: "link", marks: [{ type: "bold" }, { type: "link", href: "/x" }] },
				],
			},
			{
				id: "b_3",
				type: "bulletList",
				children: [{ id: "b_4", type: "listItem", content: [{ type: "text", text: "one" }] }],
			},
			{ id: "b_5", type: "image", attrs: { media: "m1", alt: "A cat" } },
			{ id: "b_6", type: "removedPluginBlock" },
		);
		expect(draw(body, { mediaUrl: (id) => `/media/${id}` })).toBe(
			'<h2>Title</h2><p>a <strong><a href="/x">link</a></strong></p><ul><li>one</li></ul><figure><img src="/media/m1" alt="A cat"/></figure>',
		);
	});
});

describe("one check", () => {
	it("03-2 a person's save and the assistant's block edit refuse the same bodies", async () => {
		const id = await newPost(doc(p("b_1", "Hello")));
		const bad = [
			{ block: { id: "b_9", type: "callout", attrs: { tone: "loud" } }, key: "body.badAttrs" },
			{ block: { id: "b_9", type: "nope" }, key: "body.unknownBlock" },
			{ block: { id: "b_9", type: "divider", content: [{ type: "text", text: "x" }] }, key: "body.noText" },
			{
				block: p("b_9", "x", { content: [{ type: "text", text: "x", marks: [{ type: "glow" }] }] }),
				key: "body.unknownMark",
			},
		];
		for (const { block, key } of bad) {
			await expect(
				write("entries.save", { id, version: await version(id), doc: doc(p("b_1", "Hello"), block as Block) }),
			).rejects.toMatchObject({ reason: { key } });
			await expect(
				write("body.edit", { id, version: await version(id), ops: [{ op: "insert", after: "b_1", blocks: [block] }] }),
			).rejects.toMatchObject({ reason: { key } });
		}
		await expect(
			write("entries.save", { id, version: await version(id), doc: doc(p("b_1", "Hello"), p("b_1", "Again")) }),
		).rejects.toMatchObject({ reason: { key: "body.duplicateId" } });
	});

	it("03-2 an assistant's block edit is a proposal, and it goes stale when the entry is saved first", async () => {
		const id = await newPost(doc(p("b_1", "Hello world")));
		const monti = site();
		const proposalId = await monti.proposals.create("c1", "fix the greeting");
		const { preview } = await monti.proposals.add(proposalId, "body.edit", {
			id,
			version: await version(id),
			ops: [{ op: "replaceText", block: "b_1", from: 6, to: 11, text: "there" }],
		});
		expect(preview?.changes).toEqual([{ kind: "entry", id }]);
		expect((await get(id)).entry.doc).toEqual(doc(p("b_1", "Hello world")));
		await write("entries.save", { id, version: await version(id), title: "Saved first" });
		const [item] = await monti.proposals.apply(proposalId);
		expect(item.state).toBe("stale");
	});
});

describe("block ids", () => {
	it("03-3 ids stay through inserting, moving, replacing text, saving and publishing", async () => {
		const id = await newPost(
			doc(p("b_1", "One"), {
				id: "b_2",
				type: "paragraph",
				content: [
					{ type: "text", text: "Bold", marks: [{ type: "bold" }] },
					{ type: "text", text: " tail" },
				],
			}),
		);
		await write("body.edit", {
			id,
			version: await version(id),
			ops: [
				{
					op: "insert",
					after: "b_1",
					blocks: [{ type: "quote", children: [{ type: "paragraph", content: [{ type: "text", text: "Q" }] }] }],
				},
				{ op: "move", block: "b_1", after: "b_2" },
				{ op: "replaceText", block: "b_2", from: 1, to: 6, text: "OLD" },
			],
		});
		const body = (await get(id)).entry.doc as Doc;
		const [quote, second, first] = body.blocks;
		expect(second).toEqual({
			id: "b_2",
			type: "paragraph",
			content: [
				{ type: "text", text: "BOLD", marks: [{ type: "bold" }] },
				{ type: "text", text: "ail" },
			],
		});
		expect(first.id).toBe("b_1");
		expect(quote).toMatchObject({ type: "quote", children: [{ type: "paragraph" }] });
		expect(quote.id).toMatch(/^b_/);
		expect(quote.children?.[0].id).toMatch(/^b_/);

		await write("entries.save", { id, version: await version(id), doc: body });
		await write("entries.publish", { ids: [id] });
		const published = await db
			.selectFrom("entry_published")
			.select("doc")
			.where("entry_id", "=", id)
			.executeTakeFirst();
		expect(published?.doc).toEqual(body);
	});

	it("03-3 compare counts the places that differ block by block", async () => {
		const id = await newPost(doc(p("b_1", "One"), p("b_2", "Two"), p("b_3", "Three")));
		const { places } = await read<{ places: { place: string }[] }>("entries.compare", {
			id,
			doc: doc(p("b_2", "Two"), p("b_1", "One!"), p("b_4", "Four")),
		});
		expect(places.map((place) => place.place)).toEqual(["doc.b_1", "doc.b_4", "doc.b_3", "doc.order"]);
	});

	it("03-3 the model reads the body as tagged text whose offsets replaceText counts in", async () => {
		const id = await newPost(
			doc(
				{ id: "b_1", type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Why" }] },
				{
					id: "b_2",
					type: "paragraph",
					content: [
						{ type: "text", text: "a " },
						{ type: "text", text: "link", marks: [{ type: "link", href: "/x" }] },
					],
				},
				{ id: "b_3", type: "callout", attrs: { tone: "note" }, children: [p("b_4", "Note")] },
			),
		);
		const { text } = await read<{ text: string }>("body.read", { id });
		expect(text).toBe("{#b_1} ## Why\n{#b_2} a link\n{#b_3} :::callout{tone=note}\n{#b_4} Note\n:::");
		expect((await read<{ text: string }>("body.read", { id, blocks: ["b_4"] })).text).toBe("{#b_4} Note");
	});
});

describe("templates", () => {
	it("03-4 an entry started from a template gets its blocks with new ids; removing a template can be undone", async () => {
		const body = doc(p("b_1", "도입"), {
			id: "b_2",
			type: "heading",
			attrs: { level: 2 },
			content: [{ type: "text", text: "본문" }],
		});
		const template = (await write("templates.save", { name: "기본 글", doc: body })).output.id;
		expect(await read("templates.list", {})).toEqual([
			expect.objectContaining({ id: template, name: "기본 글", blocks: 2 }),
		]);

		const id = (await write("entries.create", { collection: "post", locale: "ko", template })).output.id;
		const started = (await get(id)).entry.doc as Doc;
		expect(started.blocks.map(({ id: _id, ...block }) => block)).toEqual(
			body.blocks.map(({ id: _id, ...block }) => block),
		);
		expect(started.blocks.map((block) => block.id)).not.toContain("b_1");

		const removed = await write("templates.remove", { id: template });
		expect(await read("templates.list", {})).toEqual([]);
		await write("activity.undo", { id: removed.activityId });
		expect(await read("templates.get", { id: template })).toMatchObject({ name: "기본 글" });
	});

	it("03-4 a template is saved over only at the version that was read", async () => {
		const template = (await write("templates.save", { name: "기본 글", doc: doc() })).output.id;
		await write("templates.save", { id: template, version: 1, name: "기본", doc: doc() });
		await expect(
			write("templates.save", { id: template, version: 1, name: "늦은 저장", doc: doc() }),
		).rejects.toMatchObject({
			code: "conflict",
		});
	});
});

describe("links to entries", () => {
	const linkTo = (group: string): Block =>
		p("b_1", "", { content: [{ type: "text", text: "see this", marks: [{ type: "link", href: entryLink(group) }] }] });
	const groupOf = async (id: string) =>
		(await db.selectFrom("entries").select("translation_group").where("id", "=", id).executeTakeFirstOrThrow())
			.translation_group;

	it("02-4 a link to an entry that is not on the site is a to-do row that only tells", async () => {
		const target = await newPost(doc());
		const id = await newPost(doc(linkTo(await groupOf(target))));
		expect((await get(id)).tasks).toEqual([expect.objectContaining({ code: "unpublishedLink", blocking: false })]);
		await write("entries.publish", { ids: [id] });
		await write("entries.publish", { ids: [target] });
		expect((await get(id)).tasks).toEqual([]);
	});

	it("03-1 the site draws an entry link with the entry's path now, and as text while it is not published", async () => {
		const target = await newPost(doc());
		const body = doc(linkTo(await groupOf(target)));
		const reader = createReader({ db, schema });
		const drawn = async () => {
			const paths = await reader.linkPaths(body, "ko");
			return draw(body, { entryPath: (group) => paths[group] });
		};
		expect(await drawn()).toBe("<p>see this</p>");
		await write("entries.publish", { ids: [target] });
		expect(await drawn()).toBe('<p><a href="/posts/hello">see this</a></p>');
		await write("entries.save", { id: target, version: await version(target), slug: "renamed" });
		await write("entries.publish", { ids: [target] });
		expect(await drawn()).toBe('<p><a href="/posts/renamed">see this</a></p>');
	});
});

describe("blocks that are off", () => {
	it("03-5 a block the site no longer defines stays and the rest can still be changed; the editor allowance only filters menus", async () => {
		const id = await newPost(doc(p("b_1", "Hello"), { id: "b_2", type: "divider" }));
		await db
			.updateTable("entries")
			.set({
				doc: JSON.stringify(doc(p("b_1", "Hello"), { id: "b_2", type: "divider" }, { id: "b_3", type: "oldWidget" })),
			})
			.where("id", "=", id)
			.execute();
		await setEditor({ blocks: ["paragraph"] });
		const after = await write("body.edit", {
			id,
			version: await version(id),
			ops: [{ op: "replaceText", block: "b_1", from: 0, to: 5, text: "Hi" }],
		});
		expect(after.output).toMatchObject({ id });
		expect(((await get(id)).entry.doc as Doc).blocks.map((block) => block.type)).toEqual([
			"paragraph",
			"divider",
			"oldWidget",
		]);
		expect((await get(id)).tasks).toEqual([]);

		// A template put in by the editor brings new blocks the editor no longer offers; the server takes them as they are.
		await write("entries.save", {
			id,
			version: await version(id),
			doc: doc(
				p("b_1", "Hi"),
				{ id: "b_2", type: "divider" },
				{ id: "b_3", type: "oldWidget" },
				{ id: "b_9", type: "divider" },
			),
		});

		const template = (await write("templates.save", { name: "구분", doc: doc({ id: "b_1", type: "divider" }) })).output
			.id;
		const started = (await write("entries.create", { collection: "post", locale: "ko", template })).output.id;
		expect(((await get(started)).entry.doc as Doc).blocks.map((block) => block.type)).toEqual(["divider"]);
	});
});
