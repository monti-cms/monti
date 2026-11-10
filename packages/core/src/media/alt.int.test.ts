import { beforeEach, describe, expect, it } from "vitest";
import { testDatabase } from "../__test__/database";
import { asDoc } from "../body/doc";
import { createReader } from "../entries/reader";
import { createMonti, definePlugin } from "../monti";
import { renderDocument, type SiteMedia } from "../render";
import { defineSchema } from "../schema/define";
import type { MediaItem, MissingAlt } from "./operations";
import { memoryStorage } from "./storage";

const db = await testDatabase();
const schema = defineSchema({
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
				cover: { kind: "media", accept: "image" },
				attachment: { kind: "media", accept: "any" },
			},
		},
	},
});
const storage = memoryStorage();
const site = () => createMonti({ db, schema, plugins: [definePlugin({ name: "files", storage })] });
const read = <Output>(name: string, input: unknown) => site().run(name, input, { actor: "admin" }) as Promise<Output>;
const write = async <Output = { id: string }>(name: string, input: unknown) =>
	((await site().run(name, input, { actor: "admin" })) as { output: Output }).output;

let keys = 0;
async function upload(name: string, mime = "image/jpeg", extension = ".jpg", more: Record<string, unknown> = {}) {
	const key = `00000000-0000-4000-8000-${String(++keys).padStart(12, "0")}${extension}`;
	await storage.put(key, new Uint8Array(10), { mime });
	return write<MediaItem>("media.upload", { name, original: { key, width: 4000, height: 2000 }, ...more });
}
let slugs = 0;
const post = (more: Record<string, unknown>) =>
	write("entries.create", { collection: "post", locale: "ko", title: "글", slug: `post-${++slugs}`, ...more });
const image = (id: string, media: string, attrs: Record<string, unknown> = {}) => ({
	id,
	type: "image",
	attrs: { media, ...attrs },
});
const doc = (...blocks: unknown[]) => ({ type: "doc", blocks });
type Task = {
	code: string;
	field?: string;
	block?: string;
	blocking: boolean;
	message: { values?: { count?: number } };
};
const tasks = async (id: string) => (await read<{ tasks: Task[] }>("entries.checkPublish", { id })).tasks;
const gapTask = async (id: string) => (await tasks(id)).find((task) => task.code === "missingAlt");

beforeEach(async () => {
	await db.deleteFrom("media_uses").execute();
	await db.deleteFrom("media").execute();
	await db.deleteFrom("entry_published").execute();
	await db.deleteFrom("entries").execute();
});

describe("images with nothing to say for them", () => {
	it("09-1 T25 fields first, then the body: the to-do row counts them, blocks the publish and goes to the first", async () => {
		const file = await upload("a.jpg");
		const { id } = await post({
			values: { cover: { media: file.id } },
			doc: doc(image("b1", file.id), image("b2", file.id, { alt: "있음" })),
		});
		expect(await gapTask(id)).toMatchObject({ field: "cover", blocking: true, message: { values: { count: 2 } } });
		await expect(write("entries.publish", { ids: [id] })).rejects.toThrow();
		const missing = await read<MissingAlt[]>("entries.missingAlt", { ids: [id] });
		expect(missing.map((gap) => gap.place)).toEqual([{ field: "cover" }, { block: "b1" }]);
		expect(missing[0]).toMatchObject({ id, media: file.id, name: "a.jpg", title: "글" });
	});

	it("09-1 T25 a body alone: the row goes to the block", async () => {
		const file = await upload("a.jpg");
		const { id } = await post({ doc: doc(image("b1", file.id)) });
		expect(await gapTask(id)).toMatchObject({ field: "doc", block: "b1" });
	});

	it("09-1 T111 an emptied alt text and a switch turned off are kept as nothing, so the value says what it said", async () => {
		const { id: media } = await upload("desk.jpg");
		const made = await write<{ id: string; version: number }>("entries.create", {
			collection: "post",
			locale: "ko",
			title: "글",
			slug: "cleaned",
			values: { cover: { media, alt: "", decorative: false } },
		});
		const values = async () =>
			(await read<{ entry: { values: Record<string, unknown> } }>("entries.get", { id: made.id })).entry.values;
		expect((await values()).cover).toEqual({ media });
		await write("entries.save", {
			id: made.id,
			version: 1,
			values: { cover: { media, alt: "책상", decorative: false } },
		});
		expect((await values()).cover).toEqual({ media, alt: "책상" });
	});

	it("09-1 T25 decorative pictures, blank-free alt text and other files ask for nothing", async () => {
		const [picture, pdf] = [await upload("a.jpg"), await upload("b.pdf", "application/pdf", ".pdf")];
		const { id } = await post({
			values: { cover: { media: picture.id, decorative: true }, attachment: { media: pdf.id } },
			doc: doc(image("b1", picture.id, { decorative: true }), { id: "f", type: "file", attrs: { media: pdf.id } }),
		});
		expect(await gapTask(id)).toBeUndefined();
	});

	it("09-1 T25 only spaces is no alt text, and an image in a field that takes any file still needs one", async () => {
		const file = await upload("a.jpg");
		const { id } = await post({ values: { attachment: { media: file.id, alt: "   " } } });
		expect(await gapTask(id)).toMatchObject({ field: "attachment" });
	});

	it("09-1 entries.missingAlt finds them across a collection, and leaves the trash out", async () => {
		const file = await upload("a.jpg");
		const { id } = await post({ values: { cover: { media: file.id } } });
		await post({ values: { cover: { media: file.id, alt: "책상" } } });
		const found = await read<MissingAlt[]>("entries.missingAlt", { collection: "post" });
		expect(found.map((gap) => gap.id)).toEqual([id]);
	});
});

describe("a media field in a translation", () => {
	const value = async (id: string) =>
		(await db.selectFrom("entries").select("values").where("id", "=", id).executeTakeFirstOrThrow()).values.cover;
	const reader = () => createReader({ db, schema, storage });
	const siteEntry = async (locale: string, slug: string) => {
		const found = await reader().entry({ collection: "post", locale, slug });
		if (!found || !("entry" in found)) throw new Error("not on the site");
		return found.entry;
	};
	const versionOf = async (id: string) =>
		(await db.selectFrom("entries").select("version").where("id", "=", id).executeTakeFirstOrThrow()).version;

	async function translated(cover: string) {
		const source = await post({ values: { cover: { media: cover, alt: "책상" } } });
		const made = await write("translations.create", { source: source.id, locale: "en" });
		await write("entries.save", {
			id: made.id,
			version: await versionOf(made.id),
			title: "A post",
			slug: `en-${++slugs}`,
		});
		await write("entries.publish", { ids: [source.id, made.id] });
		const row = await db.selectFrom("entries").select("slug").where("id", "=", made.id).executeTakeFirstOrThrow();
		return { source: source.id, translation: made.id, slug: row.slug };
	}

	it("04-5 a new translation starts empty and follows the source, on the site too", async () => {
		const file = await upload("desk.jpg");
		const { translation, slug } = await translated(file.id);
		expect(await value(translation)).toBeUndefined();
		const entry = await siteEntry("en", slug);
		expect(entry.values.cover).toEqual({ media: file.id, alt: "책상" });
		expect(entry.media?.[file.id]?.name).toBe("desk.jpg");
		const uses = await db.selectFrom("media_uses").select("entry_id").execute();
		expect(uses).toHaveLength(1);
	});

	it("04-5 when the source picks another picture, a translation that follows shows it", async () => {
		const [first, second] = [await upload("first.jpg"), await upload("second.jpg")];
		const { source, slug } = await translated(first.id);
		await write("entries.save", {
			id: source,
			version: await versionOf(source),
			values: { cover: { media: second.id, alt: "책상" } },
		});
		await write("entries.publish", { ids: [source] });
		expect((await siteEntry("en", slug)).values.cover).toEqual({ media: second.id, alt: "책상" });
	});

	it("04-5 the editor shows what the site shows: the source's published picture, not a save that is not out yet", async () => {
		const [first, second] = [await upload("first.jpg"), await upload("second.jpg")];
		const { source, translation, slug } = await translated(first.id);
		await write("entries.save", {
			id: source,
			version: await versionOf(source),
			values: { cover: { media: second.id, alt: "책상" } },
		});
		const compared = await read<{ source: { values: { cover: unknown } } }>("translations.compare", {
			id: translation,
		});
		expect(compared.source.values.cover).toEqual({ media: first.id, alt: "책상" });
		expect((await siteEntry("en", slug)).values.cover).toEqual({ media: first.id, alt: "책상" });
	});

	it("04-5 a translation's own picture or words are its own, and clearing them follows the source again", async () => {
		const [first, own] = [await upload("first.jpg"), await upload("own.jpg")];
		const { translation, slug } = await translated(first.id);
		await write("entries.save", {
			id: translation,
			version: await versionOf(translation),
			values: { cover: { media: own.id, alt: "A desk" } },
		});
		await write("entries.publish", { ids: [translation] });
		expect((await siteEntry("en", slug)).values.cover).toEqual({ media: own.id, alt: "A desk" });
		expect((await db.selectFrom("media_uses").select("media_id").execute()).map((use) => use.media_id).sort()).toEqual(
			[first.id, own.id].sort(),
		);
		await write("entries.save", { id: translation, version: await versionOf(translation), values: { cover: null } });
		await write("entries.publish", { ids: [translation] });
		expect((await siteEntry("en", slug)).values.cover).toEqual({ media: first.id, alt: "책상" });
	});

	it("04-5 a body image that follows its source reads the source's alt text: writing it there frees the translation's publish", async () => {
		const file = await upload("desk.jpg");
		const source = await post({ doc: doc(image("b1", file.id)) });
		const made = await write("translations.create", { source: source.id, locale: "en" });
		const row = await db.selectFrom("entries").select("doc").where("id", "=", made.id).executeTakeFirstOrThrow();
		const [block] = asDoc(row.doc).blocks;
		if (!block) throw new Error("no block");
		await write("entries.save", {
			id: made.id,
			version: await versionOf(made.id),
			title: "A post",
			slug: `en-${++slugs}`,
			doc: doc({ ...image(block.id, file.id), link: { ...block.link, state: "followSource" } }),
		});
		expect(await gapTask(made.id)).toMatchObject({ block: block.id });
		await write("entries.save", {
			id: source.id,
			version: await versionOf(source.id),
			doc: doc(image("b1", file.id, { alt: "책상" })),
		});
		await write("entries.publish", { ids: [source.id] });
		expect(await gapTask(made.id)).toBeUndefined();
		expect(await read<MissingAlt[]>("entries.missingAlt", { collection: "post" })).toEqual([]);
	});

	it("04-5 a translation that follows asks no alt text of its own, one with its own picture does", async () => {
		const [first, own] = [await upload("first.jpg"), await upload("own.jpg")];
		const { translation } = await translated(first.id);
		expect(await gapTask(translation)).toBeUndefined();
		await write("entries.save", {
			id: translation,
			version: await versionOf(translation),
			values: { cover: { media: own.id } },
		});
		expect(await gapTask(translation)).toMatchObject({ field: "cover" });
	});
});

describe("in the entry list", () => {
	type Row = { title: string; media: Record<string, { name: string; thumbnail: string | null }> };
	const list = async (input: Record<string, unknown> = {}) =>
		(await read<{ rows: Row[] }>("entries.query", { collection: "post", ...input })).rows;

	it("09-1 T59 a media field is a column: its cell has the picture, and it filters by empty", async () => {
		const [picture, pdf] = [await upload("a.jpg"), await upload("b.pdf", "application/pdf", ".pdf")];
		await post({
			title: "표지 있음",
			values: { cover: { media: picture.id, alt: "책상" }, attachment: { media: pdf.id } },
		});
		await post({ title: "표지 없음" });
		const { columns } = await read<{ columns: { id: string; kind: string; filter: string }[] }>("list.columns", {
			collection: "post",
		});
		expect(columns.find((column) => column.id === "cover")).toMatchObject({ kind: "media", filter: "empty" });
		const rows = await list();
		const withCover = rows.find((row) => row.title === "표지 있음");
		expect(withCover?.media.cover).toEqual({ name: "a.jpg", thumbnail: picture.original.url });
		expect(withCover?.media.attachment).toEqual({ name: "b.pdf", thumbnail: null });
		expect(rows.find((row) => row.title === "표지 없음")?.media).toEqual({});
		const empty = await list({ filters: [{ on: "empty", field: "cover" }] });
		expect(empty.map((row) => row.title)).toEqual(["표지 없음"]);
	});
});

describe("a crop", () => {
	it("09-1 stays inside the picture", async () => {
		const file = await upload("a.jpg");
		const outside = post({
			doc: doc(image("b1", file.id, { alt: "책상", crop: { x: 0.9, y: 0.9, width: 1, height: 1 } })),
		});
		await expect(outside).rejects.toThrow();
		const inside = await post({
			doc: doc(image("b1", file.id, { alt: "책상", crop: { x: 0.25, y: 0.25, width: 0.75, height: 0.75 } })),
		});
		expect(inside.id).toBeTypeOf("string");
	});
});

describe("on the site", () => {
	const h = (type: unknown, props: Record<string, unknown> | null, ...children: unknown[]) => ({
		type,
		props,
		children,
	});
	const picture: SiteMedia = {
		id: "m1",
		name: "desk.jpg",
		kind: "image",
		mime: "image/jpeg",
		size: 1,
		url: "m1",
		width: 400,
		height: 200,
		original: { url: "m1", width: 400, height: 200 },
		placeholder: null,
	};

	it("09-1 the reader gives each file's web size when it has one, its original and its placeholder, and the body draws from them with its crop and turn", async () => {
		const webKey = "00000000-0000-4000-8000-00000000f001.webp";
		await storage.put(webKey, new Uint8Array(10), { mime: "image/webp" });
		const placeholder = "data:image/webp;base64,UklGRg==";
		const file = await upload("desk.jpg", "image/jpeg", ".jpg", {
			web: { key: webKey, width: 2400, height: 1200 },
			placeholder,
		});
		const made = await post({
			doc: doc(image("b1", file.id, { alt: "책상", crop: { x: 0, y: 0, width: 0.5, height: 1 } })),
		});
		await write("entries.publish", { ids: [made.id] });
		const row = await db.selectFrom("entries").select("slug").where("id", "=", made.id).executeTakeFirstOrThrow();
		const found = await createReader({ db, schema, storage }).entry({
			collection: "post",
			locale: "ko",
			slug: row.slug,
		});
		if (!found || !("entry" in found)) throw new Error("not on the site");
		const { media, doc: body } = found.entry;
		expect(media?.[file.id]).toMatchObject({
			url: storage.url(webKey),
			width: 2400,
			height: 1200,
			kind: "image",
			original: { url: file.original.url, width: 4000, height: 2000 },
			placeholder,
		});
		const [figure] = renderDocument(asDoc(body), { createElement: h, media }) as {
			children: {
				type: string;
				props: { style: { aspectRatio: number } };
				children: { props: { src: string; alt: string } }[];
			}[];
		}[];
		const box = figure?.children[0];
		expect(box?.type).toBe("span");
		expect(box?.props.style.aspectRatio).toBe(1);
		expect(box?.children[0]?.props).toMatchObject({ src: storage.url(webKey), alt: "책상" });
	});

	it("09-1 a picture sits where the editor drew it: the middle unless it says otherwise", () => {
		const draw = (attrs: Record<string, unknown>) =>
			renderDocument(asDoc(doc(image("b1", "m1", attrs))), { createElement: h, media: { m1: picture } }) as {
				props: { style?: { alignItems?: string } };
			}[];
		expect(draw({})[0]?.props.style?.alignItems).toBe("center");
		expect(draw({ align: "center" })[0]?.props.style?.alignItems).toBe("center");
		expect(draw({ align: "left" })[0]?.props.style?.alignItems).toBe("flex-start");
		expect(draw({ align: "right" })[0]?.props.style?.alignItems).toBe("flex-end");
	});

	it("09-1 a file with no words of its own for its link says its name in the library", () => {
		const draw = (attrs: Record<string, unknown>) =>
			renderDocument(asDoc(doc({ id: "f1", type: "file", attrs: { media: "m1", ...attrs } })), {
				createElement: h,
				media: { m1: { ...picture, kind: "file", name: "가격표.pdf" } },
			}) as { children: unknown[] }[];
		expect(draw({ name: "   " })[0]?.children).toEqual(["가격표.pdf"]);
		expect(draw({})[0]?.children).toEqual(["가격표.pdf"]);
		expect(draw({ name: "올해 가격" })[0]?.children).toEqual(["올해 가격"]);
	});

	it("09-1 a decorative picture has an empty alt on the site, whatever it once said", () => {
		const [figure] = renderDocument(
			{ type: "doc", blocks: [{ id: "b", type: "image", attrs: { media: "m1", alt: "옛 글", decorative: true } }] },
			{ createElement: h, media: { m1: picture } },
		) as { children: { props: { alt: string } }[] }[];
		expect(figure?.children[0]?.props.alt).toBe("");
	});
});
