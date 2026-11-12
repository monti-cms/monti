import { beforeEach, describe, expect, it } from "vitest";
import { testDatabase } from "../__test__/database";
import { CheckError, ForbiddenError, InputError } from "../errors";
import { createMonti, definePlugin } from "../monti";
import { defineSchema } from "../schema/define";
import type { TrashMoved } from "../trash/operations";
import type { MediaDetail, MediaItem, MediaQueryResult } from "./operations";
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
const write = async <Output>(name: string, input: unknown, actor: "admin" | "assistant" = "admin") =>
	(await site().run(name, input, { actor })) as { output: Output; activityId: string };

let keys = 0;
/** Puts bytes in the storage as the byte route does, and gives the key. */
async function bytes(mime = "image/jpeg", extension = ".jpg") {
	const key = `00000000-0000-4000-8000-${String(++keys).padStart(12, "0")}${extension}`;
	await storage.put(key, new Uint8Array(1234), { mime });
	return key;
}
/** A picture's size, which an image comes up with. */
const SIZE = { width: 10, height: 10 };
const upload = async (name: string, more: Record<string, unknown> = {}) =>
	(await write<MediaItem>("media.upload", { name, original: { key: await bytes(), ...SIZE }, ...more })).output;
const pdf = async (name: string, more: Record<string, unknown> = {}) =>
	(
		await write<MediaItem>("media.upload", {
			name,
			original: { key: await bytes("application/pdf", ".pdf") },
			...more,
		})
	).output;
const folder = async (name: string, parentId: string | null = null) =>
	(await write<{ id: string }>("folders.create", { scope: "media", parentId, name })).output.id;
const query = (input: unknown = {}) => read<MediaQueryResult>("media.query", input);
const names = async (input: unknown) => (await query(input)).items.map((item) => item.name);
const refused = async (run: Promise<unknown>, key: string) => {
	const error = await run.catch((caught: unknown) => caught);
	expect(error).toBeInstanceOf(CheckError);
	expect((error as CheckError).reason.key).toBe(key);
};

beforeEach(async () => {
	await db.deleteFrom("media_uses").execute();
	await db.deleteFrom("media").execute();
	await db.deleteFrom("entry_published").execute();
	await db.deleteFrom("entries").execute();
	await db.deleteFrom("templates").execute();
	await db.deleteFrom("folders").execute();
});

describe("uploading", () => {
	it("09-1 a file whose bytes went up becomes a library item, with its sizes, type and addresses", async () => {
		const original = await bytes();
		const web = await bytes();
		const { output } = await write<MediaItem>("media.upload", {
			name: "desk-morning.jpg",
			original: { key: original, width: 4032, height: 2688 },
			web: { key: web, width: 2400, height: 1600 },
		});
		expect(output).toMatchObject({
			name: "desk-morning.jpg",
			kind: "image",
			mime: "image/jpeg",
			size: 1234,
			folderId: null,
			uses: 0,
			original: { url: storage.url(original), width: 4032, height: 2688 },
			web: { url: storage.url(web), width: 2400, height: 1600 },
		});
		expect(output.version).toBe(1);
		expect(output.path).toEqual([]);
	});

	it("09-1 a picture's placeholder is a small data URL kept with it, never an address, and a new file brings its own", async () => {
		const placeholder = "data:image/webp;base64,UklGRiQAAABXRUJQ";
		const kept = async (id: string) =>
			(await db.selectFrom("media").select("placeholder").where("id", "=", id).executeTakeFirstOrThrow()).placeholder;
		const { output } = await write<MediaItem>("media.upload", {
			name: "a.jpg",
			original: { key: await bytes(), width: 10, height: 10 },
			placeholder,
		});
		expect(await kept(output.id)).toBe(placeholder);
		await expect(
			write("media.upload", {
				name: "b.jpg",
				original: { key: await bytes(), ...SIZE },
				placeholder: "https://example.com/tiny.png",
			}),
		).rejects.toBeInstanceOf(InputError);
		await expect(
			write("media.upload", {
				name: "c.jpg",
				original: { key: await bytes(), ...SIZE },
				placeholder: `data:image/webp;base64,${"A".repeat(5000)}`,
			}),
		).rejects.toBeInstanceOf(InputError);
		// Base64 that does not end where it should is no picture.
		await expect(
			write("media.upload", {
				name: "d.jpg",
				original: { key: await bytes(), ...SIZE },
				placeholder: "data:image/png;base64,A",
			}),
		).rejects.toBeInstanceOf(InputError);
		const next = "data:image/png;base64,iVBORw0KGgo=";
		await write("media.replace", { id: output.id, original: { key: await bytes(), ...SIZE }, placeholder: next });
		expect(await kept(output.id)).toBe(next);
		await write("media.replace", { id: output.id, original: { key: await bytes(), ...SIZE } });
		expect(await kept(output.id)).toBeNull();
	});

	it("09-1 an image comes with its size, which the site draws it at; a file needs none", async () => {
		await refused(write("media.upload", { name: "a.jpg", original: { key: await bytes() } }), "media.imageSize");
		const picture = await upload("b.jpg");
		await refused(
			write("media.replace", { id: picture.id, original: { key: await bytes(), width: 10 } }),
			"media.imageSize",
		);
		const file = await pdf("c.pdf", { placeholder: "data:image/png;base64,iVBORw0KGgo=" });
		expect(file).toMatchObject({ kind: "file", original: { width: null, height: null } });
		// Only a picture keeps a placeholder.
		const row = await db.selectFrom("media").select("placeholder").where("id", "=", file.id).executeTakeFirstOrThrow();
		expect(row.placeholder).toBeNull();
	});

	it("09-1 a PDF is a file, with no web size", async () => {
		expect(await pdf("price-list-2026.pdf")).toMatchObject({ kind: "file", mime: "application/pdf", web: null });
	});

	it("09-1 only a person uploads and replaces: the assistant has no file to give", async () => {
		const key = await bytes();
		await expect(
			write("media.upload", { name: "a.jpg", original: { key, ...SIZE } }, "assistant"),
		).rejects.toBeInstanceOf(ForbiddenError);
		const file = await upload("a.jpg");
		await expect(
			write("media.replace", { id: file.id, original: { key, ...SIZE } }, "assistant"),
		).rejects.toBeInstanceOf(ForbiddenError);
	});

	it("09-1 a key must have bytes behind it, belong to no other file, and be the server's own", async () => {
		await refused(
			write("media.upload", { name: "a.jpg", original: { key: "00000000-0000-4000-8000-999999999999.jpg" } }),
			"media.unknownKey",
		);
		await refused(write("media.upload", { name: "a.jpg", original: { key: "../../etc/passwd" } }), "media.unknownKey");
		const key = await bytes();
		await write("media.upload", { name: "a.jpg", original: { key, ...SIZE } });
		await refused(write("media.upload", { name: "b.jpg", original: { key, ...SIZE } }), "media.keyTaken");
	});

	it("09-1 one key cannot be both sizes, and two uploads at once cannot take each other's keys", async () => {
		const key = await bytes();
		await refused(
			write("media.upload", { name: "a.jpg", original: { key, ...SIZE }, web: { key, width: 100, height: 100 } }),
			"media.keyTaken",
		);
		const [first, second] = [await bytes(), await bytes()];
		const answers = await Promise.allSettled([
			write("media.upload", {
				name: "a.jpg",
				original: { key: first, ...SIZE },
				web: { key: second, width: 100, height: 100 },
			}),
			write("media.upload", {
				name: "b.jpg",
				original: { key: second, ...SIZE },
				web: { key: first, width: 100, height: 100 },
			}),
		]);
		expect(answers.filter((answer) => answer.status === "fulfilled")).toHaveLength(1);
	});

	it("09-1 a web size is a picture no larger than the web size, and only a picture has one", async () => {
		const original = await bytes();
		const pdfKey = await bytes("application/pdf", ".pdf");
		await refused(
			write("media.upload", {
				name: "a.jpg",
				original: { key: original, ...SIZE },
				web: { key: pdfKey, width: 100, height: 100 },
			}),
			"media.badWeb",
		);
		const web = await bytes();
		await expect(
			write("media.upload", {
				name: "a.jpg",
				original: { key: original, ...SIZE },
				web: { key: web, width: 9999, height: 100 },
			}),
		).rejects.toBeInstanceOf(InputError);
		const pdfOriginal = await bytes("application/pdf", ".pdf");
		await refused(
			write("media.upload", {
				name: "a.pdf",
				original: { key: pdfOriginal },
				web: { key: web, width: 100, height: 100 },
			}),
			"media.badWeb",
		);
	});

	it("09-1 a site with no storage says so and takes no file", async () => {
		const bare = createMonti({ db, schema });
		const answer = (await bare.run("media.query", {}, { actor: "admin" })) as MediaQueryResult;
		expect(answer.storage).toBe(false);
		await refused(
			bare.run("media.upload", { name: "a.jpg", original: { key: await bytes(), ...SIZE } }, { actor: "admin" }),
			"media.noStorage",
		);
		expect((await query()).storage).toBe(true);
	});

	it("09-1 two plugins with a storage are refused when the site starts", () => {
		const plugins = [definePlugin({ name: "one", storage }), definePlugin({ name: "two", storage })];
		expect(() => createMonti({ db, schema, plugins })).toThrow(/one, two/);
	});
});

describe("browsing", () => {
	it("09-1 a folder lists what sits right in it; the top level what is in no folder", async () => {
		const assets = await folder("Blog Assets");
		const covers = await folder("covers", assets);
		await upload("top.jpg");
		await upload("in-assets.jpg", { folderId: assets });
		await upload("in-covers.jpg", { folderId: covers });
		expect(await names({ folder: null })).toEqual(["top.jpg"]);
		expect(await names({ folder: assets })).toEqual(["in-assets.jpg"]);
	});

	it("09-1 a search in a folder goes through its subfolders, wide open with scope all, and each result says where it is", async () => {
		const assets = await folder("Blog Assets");
		const covers = await folder("covers", assets);
		await upload("cover-top.jpg");
		await upload("cover-here.jpg", { folderId: assets });
		await upload("cover-deep.jpg", { folderId: covers });
		await upload("other.jpg", { folderId: covers });
		expect((await names({ folder: assets, search: "COVER" })).sort()).toEqual(["cover-deep.jpg", "cover-here.jpg"]);
		const everywhere = await query({ folder: assets, scope: "all", search: "cover" });
		expect(everywhere.items.map((item) => item.name).sort()).toEqual([
			"cover-deep.jpg",
			"cover-here.jpg",
			"cover-top.jpg",
		]);
		expect(everywhere.items.find((item) => item.name === "cover-deep.jpg")?.path).toEqual(["Blog Assets", "covers"]);
	});

	it("09-3 T117 what a window can take narrows every listing and looks for nothing: a folder still lists what sits right in it", async () => {
		const assets = await folder("Blog Assets");
		const covers = await folder("covers", assets);
		await upload("here.jpg", { folderId: assets });
		await upload("deep.jpg", { folderId: covers });
		await upload("top.jpg");
		await pdf("notes.pdf", { folderId: assets });
		expect(await names({ folder: assets, only: "image" })).toEqual(["here.jpg"]);
		expect(await names({ folder: covers, only: "image" })).toEqual(["deep.jpg"]);
		expect(await names({ folder: null, only: "image" })).toEqual(["top.jpg"]);
		expect(await names({ folder: assets, only: "file" })).toEqual(["notes.pdf"]);
		expect((await names({ folder: assets, only: "image", search: "e" })).sort()).toEqual(["deep.jpg", "here.jpg"]);
	});

	it("09-1 kind and use look through folders as a search does: the open folder and those under it, all of them on request, everything from the top", async () => {
		const assets = await folder("Blog Assets");
		const covers = await folder("covers", assets);
		await upload("here.jpg", { folderId: assets });
		await upload("deep.jpg", { folderId: covers });
		await upload("top.jpg");
		const sorted = { sort: "name" };
		expect(await names({ folder: assets, ...sorted })).toEqual(["here.jpg"]);
		expect(await names({ folder: assets, kinds: ["image"], ...sorted })).toEqual(["deep.jpg", "here.jpg"]);
		expect(await names({ folder: assets, kinds: ["image"], ...sorted, dir: "desc" })).toEqual(["here.jpg", "deep.jpg"]);
		expect(await names({ folder: assets, used: ["unused"], ...sorted })).toEqual(["deep.jpg", "here.jpg"]);
		expect(await names({ folder: assets, scope: "all", kinds: ["image"], ...sorted })).toEqual([
			"deep.jpg",
			"here.jpg",
			"top.jpg",
		]);
		expect(await names({ folder: null, kinds: ["image"], ...sorted })).toEqual(["deep.jpg", "here.jpg", "top.jpg"]);
		// A menu's count is what picking it would find.
		expect((await query({ folder: assets })).counts).toMatchObject({ image: 2, unused: 2 });
		expect((await query({ folder: assets, scope: "all" })).counts).toMatchObject({ image: 3, unused: 3 });
		expect((await query({ folder: null })).counts).toMatchObject({ image: 3, unused: 3 });
	});

	it("09-1 a percent sign in a search is a percent sign", async () => {
		await upload("100%-done.jpg");
		await upload("other.jpg");
		expect(await names({ search: "100%" })).toEqual(["100%-done.jpg"]);
		expect(await names({ search: "%" })).toEqual(["100%-done.jpg"]);
	});

	it("09-1 kind and use filter; the filter menus count the open folder's own files", async () => {
		const used = await upload("used.jpg");
		await upload("free.jpg");
		await pdf("doc.pdf");
		await write("entries.create", {
			collection: "post",
			locale: "ko",
			title: "글",
			slug: "post-a",
			values: { cover: { media: used.id, alt: "책상" } },
		});
		expect(await names({ kinds: ["file"] })).toEqual(["doc.pdf"]);
		expect(await names({ used: ["used"] })).toEqual(["used.jpg"]);
		expect(await names({ used: ["unused"], sort: "name" })).toEqual(["doc.pdf", "free.jpg"]);
		expect((await query({ folder: null })).counts).toEqual({ image: 2, file: 1, used: 1, unused: 2 });
	});

	it("09-1 sorts by newest upload, name or size; pages hold 100", async () => {
		const small = await upload("b.jpg");
		await storage.put(`00000000-0000-4000-8000-000000000a01.jpg`, new Uint8Array(9000), { mime: "image/jpeg" });
		const big = (
			await write<MediaItem>("media.upload", {
				name: "a.jpg",
				original: { key: "00000000-0000-4000-8000-000000000a01.jpg", ...SIZE },
			})
		).output;
		expect((await query({ sort: "name" })).items.map((item) => item.id)).toEqual([big.id, small.id]);
		expect((await query({ sort: "size" })).items[0]?.id).toBe(big.id);
		const empty = await query({ page: 2 });
		expect(empty).toMatchObject({ items: [], total: 2, page: 2, pageSize: 100 });
	});

	it("09-1 T110 ids find those files wherever they are, the trash too, counted among themselves, and nothing for none", async () => {
		const assets = await folder("Blog Assets");
		const one = await upload("one.jpg", { folderId: assets });
		const two = await upload("two.jpg");
		expect(await names({ ids: [one.id] })).toEqual(["one.jpg"]);
		// In the trash too, as media.get: a draft can hold a file trashed since, and saving it brings the file back.
		await write("trash.move", { rows: [{ kind: "media", id: two.id }] });
		expect(await names({ ids: [two.id] })).toEqual(["two.jpg"]);
		expect(await names({})).toEqual(["one.jpg"]);
		expect((await query({ ids: [one.id] })).counts).toEqual({ image: 1, file: 0, used: 0, unused: 1 });
		expect(await names({ ids: [] })).toEqual([]);
		expect((await query({ ids: [] })).counts).toEqual({ image: 0, file: 0, used: 0, unused: 0 });
	});
});

describe("changing", () => {
	it("09-1 a rename keeps the extension and undoing puts the old name back", async () => {
		const file = await upload("desk.jpg");
		const renamed = await write<MediaItem>("media.update", { id: file.id, name: "morning" });
		expect(renamed.output.name).toBe("morning.jpg");
		expect((await write<MediaItem>("media.update", { id: file.id, name: "noon.jpg" })).output.name).toBe("noon.jpg");
		expect((await write<MediaItem>("media.update", { id: file.id, name: "a/b.png" })).output.name).toBe("a-b.png.jpg");
		await refused(write("media.update", { id: file.id, name: "   " }), "media.badName");
		await refused(write("media.update", { id: file.id, name: "" }), "media.badName");
		// The newer renames changed the record, so that undo has nothing left to put back and says so: only an undo of the last one takes it back.
		await refused(write("activity.undo", { id: renamed.activityId }), "activity.allChanged");
		expect((await read<MediaDetail>("media.get", { id: file.id })).name).toBe("a-b.png.jpg");
	});

	it("09-1 a new name and a new folder go together in one write, or neither does", async () => {
		const assets = await folder("Blog Assets");
		const file = await upload("desk.jpg");
		const { output, activityId } = await write<MediaItem>("media.update", {
			id: file.id,
			name: "morning",
			folder: assets,
		});
		expect(output).toMatchObject({ name: "morning.jpg", folderId: assets });
		await refused(write("media.update", { id: file.id, name: "noon", folder: "no-such-folder" }), "folders.unknown");
		expect((await read<MediaDetail>("media.get", { id: file.id })).name).toBe("morning.jpg");
		await write("activity.undo", { id: activityId });
		expect(await read<MediaDetail>("media.get", { id: file.id })).toMatchObject({ name: "desk.jpg", folderId: null });
	});

	it("09-1 a window can ask for more than a page", async () => {
		await upload("one.jpg");
		await upload("two.jpg");
		expect(await query({ pageSize: 1 })).toMatchObject({ pageSize: 1, total: 2, items: [expect.anything()] });
	});

	it("09-1 files move into a folder and back to the top, with the folder's count following; undo moves them back", async () => {
		const assets = await folder("Blog Assets");
		const one = await upload("one.jpg");
		const two = await upload("two.jpg");
		const moved = await write("media.moveToFolder", { ids: [one.id, two.id], folder: assets });
		expect(await names({ folder: null })).toEqual([]);
		expect((await names({ folder: assets })).sort()).toEqual(["one.jpg", "two.jpg"]);
		await write("activity.undo", { id: moved.activityId });
		expect((await names({ folder: null })).sort()).toEqual(["one.jpg", "two.jpg"]);
	});

	it("09-1 undoing a folder's creation leaves no file in a folder that is gone: it waits at the top level", async () => {
		const made = await write<{ id: string }>("folders.create", { scope: "media", parentId: null, name: "Blog Assets" });
		const one = await upload("one.jpg");
		await write("media.moveToFolder", { ids: [one.id], folder: made.output.id });
		await write("activity.undo", { id: made.activityId });
		expect(await names({ folder: null })).toEqual(["one.jpg"]);
	});

	it("09-1 a move by media.update is logged as a move, not as a rename", async () => {
		const assets = await folder("Blog Assets");
		const one = await upload("one.jpg");
		const moved = await write("media.update", { id: one.id, folder: assets });
		const row = await db
			.selectFrom("monti_activity")
			.select("summary")
			.where("id", "=", moved.activityId)
			.executeTakeFirstOrThrow();
		expect(row.summary.key).toBe("media.moveToFolder");
	});

	it("09-1 the folder tree counts files, with its subfolders", async () => {
		const assets = await folder("Blog Assets");
		const covers = await folder("covers", assets);
		await upload("one.jpg", { folderId: assets });
		await upload("two.jpg", { folderId: covers });
		await upload("top.jpg");
		const { folders } = await read<{ folders: { id: string; count: number }[] }>("folders.tree", { scope: "media" });
		expect(folders.map((node) => [node.id, node.count])).toEqual([
			[assets, 2],
			[covers, 1],
		]);
	});

	it("09-1 removing a folder nobody's files are used from takes it all, and undo brings it all back", async () => {
		const assets = await folder("Blog Assets");
		const covers = await folder("covers", assets);
		await upload("one.jpg", { folderId: assets });
		await upload("two.jpg", { folderId: covers });
		const { output, activityId } = await write<TrashMoved>("trash.move", { rows: [{ kind: "folder", id: assets }] });
		expect([output.moved.length, output.kept.length]).toEqual([2, 0]);
		expect((await read<{ folders: unknown[] }>("folders.tree", { scope: "media" })).folders).toEqual([]);
		expect(await names({})).toEqual([]);
		await write("activity.undo", { id: activityId });
		expect((await read<{ folders: unknown[] }>("folders.tree", { scope: "media" })).folders).toHaveLength(2);
		expect((await names({})).sort()).toEqual(["one.jpg", "two.jpg"]);
	});

	it("09-4 removing a folder with a file in use: the file stays, with the folders above it; the rest goes", async () => {
		const assets = await folder("Blog Assets");
		const covers = await folder("covers", assets);
		const drafts = await folder("drafts", assets);
		const inUse = await upload("cover.jpg", { folderId: covers });
		await upload("free-in-covers.jpg", { folderId: covers });
		await upload("free-in-assets.jpg", { folderId: assets });
		await upload("free-in-drafts.jpg", { folderId: drafts });
		await write("entries.create", {
			collection: "post",
			locale: "ko",
			title: "글",
			slug: "post-keep",
			values: { cover: { media: inUse.id, alt: "표지" } },
		});
		const { output } = await write<TrashMoved>("trash.move", { rows: [{ kind: "folder", id: assets }] });
		expect([output.moved.length, output.kept]).toEqual([3, [inUse.id]]);
		const { folders } = await read<{ folders: { name: string; count: number }[] }>("folders.tree", { scope: "media" });
		expect(folders.map((node) => [node.name, node.count])).toEqual([
			["Blog Assets", 1],
			["covers", 1],
		]);
		expect(await names({})).toEqual(["cover.jpg"]);
	});

	it("09-1 a collection's folder is no place for a file", async () => {
		const file = await upload("one.jpg");
		const posts = (
			await write<{ id: string }>("folders.create", { scope: { collection: "post" }, parentId: null, name: "글" })
		).output.id;
		await refused(write("media.moveToFolder", { ids: [file.id], folder: posts }), "folders.otherScope");
	});
});

describe("alt text belongs to the entry", () => {
	it("09-2 the library's answers have no alt text or caption, and two entries say different things of one file", async () => {
		const file = await upload("desk.jpg");
		const [first, second] = await Promise.all(
			["첫 글", "둘째 글"].map(async (title, at) =>
				write<{ id: string }>("entries.create", {
					collection: "post",
					locale: "ko",
					title,
					slug: `post-${at}`,
					values: { cover: { media: file.id, alt: `${title}의 책상` } },
				}),
			),
		);
		const detail = await read<MediaDetail>("media.get", { id: file.id });
		expect(JSON.stringify(detail)).not.toMatch(/alt|caption/i);
		expect(JSON.stringify(await query())).not.toMatch(/"alt"|caption/i);
		const entries = await db.selectFrom("entries").select(["id", "values"]).execute();
		const alts = entries.map((entry) => (entry.values.cover as { alt: string }).alt).sort();
		expect(alts).toEqual(["둘째 글의 책상", "첫 글의 책상"]);
		expect([first?.output.id, second?.output.id]).toHaveLength(2);
	});

	it("09-2 a media field holds a file and its alt text, not anything else", async () => {
		await refused(
			write("entries.create", {
				collection: "post",
				locale: "ko",
				title: "글",
				slug: "bad",
				values: { cover: "not a value" },
			}),
			"entries.badMedia",
		);
	});
});

describe("replacing", () => {
	it("09-5 the file changes under the same id; what uses it keeps its alt text and caption, and it gets a new key", async () => {
		const file = await upload("desk.jpg");
		const made = await write<{ id: string }>("entries.create", {
			collection: "post",
			locale: "ko",
			title: "글",
			slug: "post-r",
			values: { cover: { media: file.id, alt: "아침 책상" } },
			doc: {
				type: "doc",
				blocks: [{ id: "b_1", type: "image", attrs: { media: file.id, alt: "본문 책상", caption: "캡션" } }],
			},
		});
		const key = await bytes("image/png", ".png");
		const { output } = await write<MediaItem>("media.replace", {
			id: file.id,
			original: { key, width: 800, height: 600 },
		});
		expect(output).toMatchObject({
			id: file.id,
			name: "desk.png",
			mime: "image/png",
			original: { url: storage.url(key), width: 800, height: 600 },
			web: null,
			version: file.version + 1,
		});
		const entry = await db
			.selectFrom("entries")
			.select(["values", "doc"])
			.where("id", "=", made.output.id)
			.executeTakeFirstOrThrow();
		expect(entry.values.cover).toEqual({ media: file.id, alt: "아침 책상" });
		expect(entry.doc).toMatchObject({ blocks: [{ attrs: { media: file.id, alt: "본문 책상", caption: "캡션" } }] });
		expect((await read<MediaDetail>("media.get", { id: file.id })).useRows).toHaveLength(2);
	});

	it("09-5 an image stays an image, a file a file", async () => {
		const file = await upload("desk.jpg");
		await refused(
			write("media.replace", { id: file.id, original: { key: await bytes("application/pdf", ".pdf") } }),
			"media.kindChanged",
		);
	});

	it("09-5 the preview counts the places that will change", async () => {
		const file = await upload("desk.jpg");
		await write("entries.create", {
			collection: "post",
			locale: "ko",
			title: "글",
			slug: "post-p",
			values: { cover: { media: file.id, alt: "책상" } },
		});
		const key = await bytes();
		const preview = await site()
			.operations.get("media.replace")
			?.preview?.(
				{ id: file.id, original: { key } },
				{
					db,
					actor: "admin",
					emit: () => {},
					created: () => {},
					site: site().site,
					now: () => new Date(),
					session: null,
				},
			);
		expect(preview?.summary).toEqual({ key: "media.replacePreview", values: { name: "desk.jpg", uses: 1 } });
	});
});

describe("the trash", () => {
	it("09-4 a file nobody uses goes to the trash, and undo brings it back", async () => {
		const file = await upload("free.jpg");
		const { output, activityId } = await write<TrashMoved>("trash.move", { rows: [{ kind: "media", id: file.id }] });
		expect(output).toMatchObject({ moved: [file.id], kept: [] });
		expect(await names({})).toEqual([]);
		expect((await read<MediaDetail>("media.get", { id: file.id })).trashedAt).not.toBeNull();
		await write("activity.undo", { id: activityId });
		expect(await names({})).toEqual(["free.jpg"]);
	});
});

describe("a replaced file and the site", () => {
	it("16-3 replacing or renaming a file says so, so a site that keeps its pages draws them again; moving it to a folder does not", async () => {
		const sent: string[] = [];
		const monti = createMonti({
			db,
			schema,
			plugins: [definePlugin({ name: "files", storage })],
			receivers: [{ destination: "test", send: async (event) => void sent.push(`${event.type} ${event.ids.join()}`) }],
		});
		const made = (await monti.run(
			"media.upload",
			{ name: "a.jpg", original: { key: await bytes(), ...SIZE } },
			{ actor: "admin" },
		)) as { output: MediaItem };
		await monti.run(
			"media.replace",
			{ id: made.output.id, original: { key: await bytes(), ...SIZE } },
			{ actor: "admin" },
		);
		// A new name shows where a page offers the file to download; a move to another folder shows nowhere.
		await monti.run("media.update", { id: made.output.id, name: "b" }, { actor: "admin" });
		await monti.run("media.update", { id: made.output.id, folder: null }, { actor: "admin" });
		expect(sent).toEqual([
			`media.uploaded ${made.output.id}`,
			`media.replaced ${made.output.id}`,
			`media.renamed ${made.output.id}`,
		]);

		// A rename undone: the name is what it was, and the pages that show it are to be drawn again. A move to a folder undone shows nowhere.
		const act = async (name: string, input: unknown) =>
			(await monti.run(name, input, { actor: "admin" })) as { activityId: string };
		const renamed = await act("media.update", { id: made.output.id, name: "c" });
		sent.length = 0;
		await monti.run("activity.undo", { id: renamed.activityId }, { actor: "admin" });
		expect(sent).toEqual([`media.renamed ${made.output.id}`]);
		const folder = (await monti.run(
			"folders.create",
			{ scope: "media", parentId: null, name: "f" },
			{ actor: "admin" },
		)) as {
			output: { id: string };
		};
		const moved = await act("media.update", { id: made.output.id, folder: folder.output.id });
		sent.length = 0;
		await monti.run("activity.undo", { id: moved.activityId }, { actor: "admin" });
		expect(sent).toEqual([]);
	});
});
