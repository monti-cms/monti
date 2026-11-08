import { beforeEach, describe, expect, it } from "vitest";
import { testDatabase } from "../__test__/database";
import { CheckError } from "../errors";
import { createMonti, definePlugin } from "../monti";
import { migrateContent } from "../schema/apply";
import { defineSchema } from "../schema/define";
import type { MediaItem, MediaTrashResult } from "./operations";
import { memoryStorage } from "./storage";
import { usesInDoc, usesInValues } from "./uses";

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
		author: {
			kind: "item",
			path: "/authors/:slug",
			fields: {
				title: { kind: "text", required: true },
				slug: { kind: "slug", required: true },
				photo: { kind: "media", accept: "image" },
			},
		},
	},
});

const storage = memoryStorage();
const site = () => createMonti({ db, schema, plugins: [definePlugin({ name: "files", storage })] });
type Written<Output> = { output: Output; activityId: string; versions: Record<string, number | null> };
const write = async <Output = { id: string; version: number }>(name: string, input: unknown) =>
	(await site().run(name, input, { actor: "admin" })) as Written<Output>;

let keys = 0;
async function file(name = "photo.jpg") {
	const key = `00000000-0000-4000-8000-${String(++keys).padStart(12, "0")}.jpg`;
	await storage.put(key, new Uint8Array(10), { mime: "image/jpeg" });
	return (await write<MediaItem>("media.upload", { name, original: { key } })).output.id;
}
const image = (id: string, media: string) => ({ id, type: "image", attrs: { media, alt: "그림" } });
const doc = (...blocks: unknown[]) => ({ type: "doc", blocks });

let slugs = 0;
const post = (more: Record<string, unknown> = {}) =>
	write("entries.create", { collection: "post", locale: "ko", title: "글", slug: `post-${++slugs}`, ...more });
const versionOf = async (id: string) =>
	(await db.selectFrom("entries").select("version").where("id", "=", id).executeTakeFirstOrThrow()).version;

/** The rows of `media_uses`, as `<file> <owner> <place>`. */
async function rows() {
	const found = await db.selectFrom("media_uses").selectAll().execute();
	return found.map((row) => `${row.media_id} ${row.entry_id ?? row.template_id} ${row.place}`).sort();
}

/**
 * The table against what the entries and templates hold now: whatever the write did, it must say the same as reading them again. Files the library does not have
 * write no row.
 */
async function expectInStep() {
	const known = new Set((await db.selectFrom("media").select("id").execute()).map((row) => row.id));
	const expected = new Set<string>();
	const add = (owner: string, uses: { media: string; place: { field: string } | { block: string } }[]) => {
		for (const { media, place } of uses)
			if (known.has(media))
				expected.add(`${media} ${owner} ${"field" in place ? `field:${place.field}` : `block:${place.block}`}`);
	};
	for (const copy of [
		...(await db.selectFrom("entries").select(["id", "collection", "values", "doc"]).execute()),
		...(await db.selectFrom("entry_published").select(["entry_id as id", "collection", "values", "doc"]).execute()),
	])
		add(copy.id, [
			...usesInValues(schema.collections[copy.collection]?.fields ?? {}, copy.values),
			...usesInDoc(copy.doc),
		]);
	for (const template of await db.selectFrom("templates").select(["id", "doc"]).execute())
		add(template.id, usesInDoc(template.doc));
	expect(await rows()).toEqual([...expected].sort());
}

beforeEach(async () => {
	await db.deleteFrom("media_uses").execute();
	await db.deleteFrom("media").execute();
	await db.deleteFrom("entry_published").execute();
	await db.deleteFrom("entries").execute();
	await db.deleteFrom("templates").execute();
	await db.deleteFrom("folders").execute();
	await db.deleteFrom("monti_proposal_item").execute();
	await db.deleteFrom("monti_proposal").execute();
});

describe("every way a body or a field changes writes the uses again", () => {
	it("09-4 entries.create and entries.save: a new file in, an old one out, both from fields and the body", async () => {
		const [cover, body, next] = [await file(), await file(), await file()];
		const { output } = await post({ values: { cover: { media: cover, alt: "표지" } }, doc: doc(image("b1", body)) });
		expect(await rows()).toEqual([`${cover} ${output.id} field:cover`, `${body} ${output.id} block:b1`].sort());
		await write("entries.save", {
			id: output.id,
			version: await versionOf(output.id),
			values: { cover: { media: next, alt: "표지" } },
			doc: doc(),
		});
		expect(await rows()).toEqual([`${next} ${output.id} field:cover`]);
		await expectInStep();
	});

	it("09-4 entries.duplicate: the copy uses the files too", async () => {
		const cover = await file();
		const { output } = await post({ values: { cover: { media: cover, alt: "표지" } } });
		const copy = await write("entries.duplicate", { id: output.id });
		expect(await rows()).toEqual(
			[`${cover} ${copy.output.id} field:cover`, `${cover} ${output.id} field:cover`].sort(),
		);
		await expectInStep();
	});

	it("09-4 entries.publish and entries.archive: what the published copy holds counts until the copy is gone", async () => {
		const [old, fresh] = [await file(), await file()];
		const { output } = await post({ doc: doc(image("b1", old)) });
		await write("entries.publish", { ids: [output.id] });
		await write("entries.save", { id: output.id, version: await versionOf(output.id), doc: doc(image("b1", fresh)) });
		expect(await rows()).toEqual([`${fresh} ${output.id} block:b1`, `${old} ${output.id} block:b1`].sort());
		await write("entries.archive", { ids: [output.id] });
		expect(await rows()).toEqual([`${fresh} ${output.id} block:b1`]);
		await expectInStep();
	});

	it("09-4 body.edit: a block put in by the assistant's edit, then taken out", async () => {
		const body = await file();
		const { output } = await post();
		await write("body.edit", {
			id: output.id,
			version: await versionOf(output.id),
			ops: [{ op: "insert", after: null, blocks: [{ id: "b9", type: "image", attrs: { media: body, alt: "그림" } }] }],
		});
		expect(await rows()).toEqual([`${body} ${output.id} block:b9`]);
		await write("body.edit", {
			id: output.id,
			version: await versionOf(output.id),
			ops: [{ op: "remove", blocks: ["b9"] }],
		});
		expect(await rows()).toEqual([]);
	});

	it("09-4 a proposal applied: the assistant's save writes its uses as a person's does", async () => {
		const cover = await file();
		const { output } = await post();
		const monti = site();
		const proposal = await monti.proposals.create("c1", "표지 넣어 줘");
		await monti.proposals.add(proposal, "entries.save", {
			id: output.id,
			version: await versionOf(output.id),
			values: { cover: { media: cover, alt: "표지" } },
		});
		expect(await rows()).toEqual([]);
		await monti.proposals.apply(proposal);
		expect(await rows()).toEqual([`${cover} ${output.id} field:cover`]);
	});

	it("09-4 translations.create: a translation's copy of the body uses the file itself", async () => {
		const body = await file();
		const { output } = await post({ doc: doc(image("b1", body)) });
		const made = await write("translations.create", { source: output.id, locale: "en" });
		const uses = await rows();
		expect(uses).toHaveLength(2);
		expect(uses.some((row) => row.includes(made.output.id))).toBe(true);
		await expectInStep();
	});

	it("09-4 items.saveGroup: an item's media field counts", async () => {
		const photo = await file();
		const made = await write<{ group: string }>("items.saveGroup", {
			collection: "author",
			locales: { ko: { title: "글쓴이", slug: "writer", values: { photo: { media: photo, alt: "얼굴" } } } },
		});
		expect(made.output.group).toBeTypeOf("string");
		expect(await rows()).toHaveLength(1);
		await expectInStep();
	});

	it("09-4 templates: a template's image is a use, gone with the template", async () => {
		const body = await file();
		const made = await write("templates.save", { name: "회고", doc: doc(image("b1", body)) });
		expect(await rows()).toEqual([`${body} ${made.output.id} block:b1`]);
		await write("templates.remove", { id: made.output.id });
		expect(await rows()).toEqual([]);
	});

	it("09-4 activity.undo: the old file is used again, the new one no more", async () => {
		const [old, fresh] = [await file(), await file()];
		const { output } = await post({ values: { cover: { media: old, alt: "표지" } } });
		const saved = await write("entries.save", {
			id: output.id,
			version: await versionOf(output.id),
			values: { cover: { media: fresh, alt: "표지" } },
		});
		expect(await rows()).toEqual([`${fresh} ${output.id} field:cover`]);
		await write("activity.undo", { id: saved.activityId });
		expect(await rows()).toEqual([`${old} ${output.id} field:cover`]);
		await write("activity.undo", { id: (await post()).activityId });
		await expectInStep();
	});

	it("09-4 a schema change: a renamed field keeps its uses under the new name, a removed one drops them, a removed collection takes them along", async () => {
		const cover = await file();
		const { output } = await post({ values: { cover: { media: cover, alt: "표지" } } });
		const renamed = defineSchema({
			...schema,
			collections: {
				...schema.collections,
				post: {
					...schema.collections.post,
					fields: {
						title: { kind: "text", required: true },
						slug: { kind: "slug", required: true },
						hero: { kind: "media", accept: "image" },
					},
				},
			},
		});
		await migrateContent(db, renamed, [
			{ id: "c-rename", steps: [{ do: "renameField", collection: "post", from: "cover", to: "hero", values: "move" }] },
		]);
		expect(await rows()).toEqual([`${cover} ${output.id} field:hero`]);
		await migrateContent(db, renamed, [
			{ id: "c-remove", steps: [{ do: "removeField", collection: "post", field: "hero", values: "clear" }] },
		]);
		expect(await rows()).toEqual([]);
		await migrateContent(db, schema, []);
	});

	it("09-4 a file the library does not have writes no use, and the save still goes through", async () => {
		const { output } = await post({ values: { cover: { media: "no-such-file", alt: "표지" } } });
		expect(output.id).toBeTypeOf("string");
		expect(await rows()).toEqual([]);
	});
});

describe("a file in use stays out of the trash", () => {
	const trash = async (ids: string[]) => (await write<MediaTrashResult>("media.trash", { ids })).output;
	const trashed = async (id: string) =>
		(await db.selectFrom("media").select("trashed_at").where("id", "=", id).executeTakeFirstOrThrow()).trashed_at !==
		null;

	it("09-4 of two files, the one in use stays and the other goes", async () => {
		const [used, free] = [await file(), await file()];
		await post({ values: { cover: { media: used, alt: "표지" } } });
		expect(await trash([used, free])).toEqual({ moved: [free], kept: [used] });
		expect(await trashed(used)).toBe(false);
		expect(await trashed(free)).toBe(true);
	});

	it("09-4 a template's file, a draft's and a trashed entry's all count", async () => {
		const [inTemplate, inTrashedEntry] = [await file(), await file()];
		await write("templates.save", { name: "회고", doc: doc(image("b1", inTemplate)) });
		const made = await post({ doc: doc(image("b1", inTrashedEntry)) });
		const folder = (await write("folders.create", { scope: { collection: "post" }, parentId: null, name: "정리" }))
			.output.id;
		await write("entries.moveToFolder", { ids: [made.output.id], folder });
		await write("folders.remove", { id: folder });
		expect(await trash([inTemplate, inTrashedEntry])).toEqual({
			moved: [],
			kept: [inTemplate, inTrashedEntry].sort((a, b) => (a < b ? -1 : 1)),
		});
	});

	it("09-4 a save that takes the file out frees it", async () => {
		const cover = await file();
		const { output } = await post({ values: { cover: { media: cover, alt: "표지" } } });
		await write("entries.save", { id: output.id, version: await versionOf(output.id), values: { cover: null } });
		expect(await trash([cover])).toEqual({ moved: [cover], kept: [] });
	});

	it("09-4 an undo that uses a trashed file again brings it back out", async () => {
		const cover = await file();
		const { output } = await post({ values: { cover: { media: cover, alt: "표지" } } });
		const cleared = await write("entries.save", {
			id: output.id,
			version: await versionOf(output.id),
			values: { cover: null },
		});
		await trash([cover]);
		expect(await trashed(cover)).toBe(true);
		await write("activity.undo", { id: cleared.activityId });
		expect(await trashed(cover)).toBe(false);
	});

	it("09-4 brought back, a file whose folder is in the trash waits at the top level", async () => {
		const box = (await write("folders.create", { scope: "media", parentId: null, name: "상자" })).output.id;
		const cover = await file();
		await write("media.moveToFolder", { ids: [cover], folder: box });
		const { output } = await post({ values: { cover: { media: cover, alt: "표지" } } });
		const cleared = await write("entries.save", {
			id: output.id,
			version: await versionOf(output.id),
			values: { cover: null },
		});
		await write("folders.remove", { id: box });
		await write("activity.undo", { id: cleared.activityId });
		const row = await db
			.selectFrom("media")
			.select(["trashed_at", "folder_id"])
			.where("id", "=", cover)
			.executeTakeFirstOrThrow();
		expect(row).toEqual({ trashed_at: null, folder_id: null });
	});

	it("09-4 a save and a trash at the same moment: whichever comes first, the file in use is not in the trash", async () => {
		for (let round = 0; round < 12; round++) {
			const cover = await file();
			const { output } = await post();
			const version = await versionOf(output.id);
			const save = () =>
				write("entries.save", { id: output.id, version, values: { cover: { media: cover, alt: "표지" } } });
			await Promise.all(round % 2 === 0 ? [save(), trash([cover])] : [trash([cover]), save()]);
			const use = await db.selectFrom("media_uses").select("media_id").where("media_id", "=", cover).executeTakeFirst();
			expect(use?.media_id).toBe(cover);
			expect(await trashed(cover)).toBe(false);
		}
	});

	it("09-4 a move into a folder, a save and the folder's removal at the same moment: the file in use is not in the trash", async () => {
		for (let round = 0; round < 12; round++) {
			const box = (await write("folders.create", { scope: "media", parentId: null, name: `상자 ${round}` })).output.id;
			const cover = await file();
			const { output } = await post();
			const version = await versionOf(output.id);
			await Promise.all([
				write("media.moveToFolder", { ids: [cover], folder: box }),
				write("entries.save", { id: output.id, version, values: { cover: { media: cover, alt: "표지" } } }),
				write("folders.remove", { id: box }),
			]);
			expect(await trashed(cover)).toBe(false);
			// Moved in time or not, it does not end up in a folder that is gone.
			const row = await db.selectFrom("media").select("folder_id").where("id", "=", cover).executeTakeFirstOrThrow();
			if (row.folder_id) {
				const holder = await db
					.selectFrom("folders")
					.select("trashed_at")
					.where("id", "=", row.folder_id)
					.executeTakeFirstOrThrow();
				expect(holder.trashed_at).toBeNull();
			}
		}
	});

	it("09-1 undoing a move into a folder that has gone since leaves the file at the top level, where it can be seen", async () => {
		const box = (await write("folders.create", { scope: "media", parentId: null, name: "상자" })).output.id;
		const photo = await file();
		await write("media.moveToFolder", { ids: [photo], folder: box });
		const out = await write("media.moveToFolder", { ids: [photo], folder: null });
		await write("folders.remove", { id: box });
		await write("activity.undo", { id: out.activityId });
		const row = await db
			.selectFrom("media")
			.select(["folder_id", "trashed_at"])
			.where("id", "=", photo)
			.executeTakeFirstOrThrow();
		expect(row).toEqual({ folder_id: null, trashed_at: null });
	});

	it("09-1 undoing a folder's removal puts its files back in it", async () => {
		const box = (await write("folders.create", { scope: "media", parentId: null, name: "상자" })).output.id;
		const photo = await file();
		await write("media.moveToFolder", { ids: [photo], folder: box });
		const removed = await write("folders.remove", { id: box });
		await write("activity.undo", { id: removed.activityId });
		const row = await db
			.selectFrom("media")
			.select(["folder_id", "trashed_at"])
			.where("id", "=", photo)
			.executeTakeFirstOrThrow();
		expect(row).toEqual({ folder_id: box, trashed_at: null });
	});

	it("09-4 items.saveGroup checks a media field as a save does", async () => {
		const key = `00000000-0000-4000-8000-${String(++keys).padStart(12, "0")}.pdf`;
		await storage.put(key, new Uint8Array(10), { mime: "application/pdf" });
		const pdf = (await write<MediaItem>("media.upload", { name: "a.pdf", original: { key } })).output.id;
		const saving = (photo: unknown) =>
			write("items.saveGroup", {
				collection: "author",
				locales: { ko: { title: "글쓴이", slug: `w-${++slugs}`, values: { photo } } },
			});
		const kind = await saving({ media: pdf, alt: "얼굴" }).catch((caught: unknown) => caught);
		expect(kind).toBeInstanceOf(CheckError);
		expect((kind as CheckError).reason.key).toBe("entries.badMediaKind");
		const shape = await saving("not a value").catch((caught: unknown) => caught);
		expect(shape).toBeInstanceOf(CheckError);
		expect((shape as CheckError).reason.key).toBe("entries.badMedia");
	});

	it("09-4 a field that takes images refuses a file", async () => {
		const key = `00000000-0000-4000-8000-${String(++keys).padStart(12, "0")}.pdf`;
		await storage.put(key, new Uint8Array(10), { mime: "application/pdf" });
		const pdf = (await write<MediaItem>("media.upload", { name: "a.pdf", original: { key } })).output.id;
		const error = await post({ values: { cover: { media: pdf, alt: "표지" } } }).catch((caught: unknown) => caught);
		expect(error).toBeInstanceOf(CheckError);
		expect((error as CheckError).reason.key).toBe("entries.badMediaKind");
		await expect(post({ values: { attachment: { media: pdf } } })).resolves.toMatchObject({
			output: { id: expect.any(String) },
		});
	});
});
