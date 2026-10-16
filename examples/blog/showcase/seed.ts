/**
 * Seeds the showcase content into the database the example app points at (`DATABASE_URL`, `DATABASE_SCHEMA`), through the app's own write path
 * (`cms.contentService()`: create, save, publish). It is run by `pnpm preview:example` (`scripts/preview-example.mjs`) from this app's folder:
 *
 *   pnpm exec tsx --env-file=.env.local showcase/seed.ts <port>
 *
 * It writes a category, two tags, two published posts (`cms-elements` with every element and block in directive notation, and `cms-elements-details`
 * that links back), a published memo, a series that holds both posts and one unpublished draft, then prints the public and the admin URLs.
 * Publishing runs the same checks as the admin, so a body that has issues stops the seed, and so does any publish warning.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { cms } from "../monti.config";

const port = process.argv[2] ?? "3997";
const origin = `http://localhost:${port}`;
const read = (file: string) => readFileSync(fileURLToPath(new URL(file, import.meta.url)), "utf8");

const service = cms.contentService();

// Categories, tags and series are item collections: they are public as soon as they are created.
const category = (
	await service.createDraft({
		collection: "category",
		slug: "showcase",
		metadata: { title: "Showcase" },
		format: "mdx",
		body: "",
	})
).entry;
const tags = await Promise.all(
	[
		{ slug: "monti", title: "Monti" },
		{ slug: "blocks", title: "Blocks" },
	].map(({ slug, title }) =>
		service
			.createDraft({ collection: "tag", slug, metadata: { title }, format: "mdx", body: "" })
			.then((result) => result.entry),
	),
);
const tagIds = tags.map((tag) => tag.id);

type Entry = {
	collection: "post" | "memo";
	slug: string;
	metadata: Record<string, unknown>;
	mdx: string;
	publish: boolean;
};

const entries: Entry[] = [
	{
		collection: "post",
		slug: "cms-elements",
		metadata: { title: "CMS elements", categoryId: category.id, tagIds },
		mdx: read("cms-elements.mdx"),
		publish: true,
	},
	{
		collection: "post",
		slug: "cms-elements-details",
		metadata: { title: "CMS elements: details", categoryId: category.id, tagIds: [tagIds[0]] },
		mdx: read("cms-elements-details.mdx"),
		publish: true,
	},
	{
		collection: "post",
		slug: "cms-elements-draft",
		metadata: { title: "CMS elements: unpublished draft", categoryId: category.id, tagIds: [tagIds[1]] },
		mdx: "This draft is not published. It shows as a draft in the admin list and returns 404 on the public site.",
		publish: false,
	},
	{
		collection: "memo",
		slug: "showcase-memo",
		metadata: { title: "A showcase memo", tagIds },
		mdx: read("memo.mdx"),
		publish: true,
	},
];

// The entries link to each other, and a link to a page is stored as the id of that page when the body is saved. So every draft is created first,
// then every body is saved (each link finds its page), and only then are the entries published.
const created = await Promise.all(
	entries.map(async (entry) => ({
		entry,
		draft: (
			await service.createDraft({
				collection: entry.collection,
				slug: entry.slug,
				metadata: entry.metadata,
				format: "mdx",
				body: "Placeholder body.",
			})
		).entry,
	})),
);
const saved: { entry: Entry; id: string; version: number }[] = [];
for (const { entry, draft } of created) {
	const result = (
		await service.saveDraft(draft.id, {
			collection: entry.collection,
			slug: entry.slug,
			metadata: entry.metadata,
			format: "mdx",
			body: entry.mdx,
			expectedVersion: draft.version,
		})
	).entry;
	saved.push({ entry, id: result.id, version: result.version });
}
const idOf = (slug: string) => saved.find((item) => item.entry.slug === slug)?.id ?? "";

// The series holds both published posts, in order.
const series = (
	await service.createDraft({
		collection: "collection",
		slug: "showcase-series",
		metadata: {
			title: "Showcase series",
			summary: "The two showcase posts, in reading order.",
			itemKind: "post",
			itemIds: [idOf("cms-elements"), idOf("cms-elements-details")],
		},
		format: "mdx",
		body: "",
	})
).entry;

// The posts link to each other, so whichever is published first links to a page that is published a moment later. That warning names the target
// (`message` is its id) and goes away once the target is published, so it is not counted when the target is in this seed's publish list.
const publishing = new Set(saved.filter((item) => item.entry.publish).map((item) => item.id));
const problems: string[] = [];
for (const { entry, id, version } of saved) {
	if (!entry.publish) continue;
	const { warnings } = await service.publish({ id, expectedVersion: version });
	for (const warning of warnings) {
		if (
			warning.code === "unpublished_internal_link" &&
			warning.message !== undefined &&
			publishing.has(warning.message)
		)
			continue;
		problems.push(`${entry.slug}: ${JSON.stringify(warning)}`);
	}
}
if (problems.length > 0) throw new Error(`the showcase must publish without issues:\n${problems.join("\n")}`);

// A published post whose address was changed: the old address `renamed-post-old` answers a permanent redirect to `renamed-post` (`example:check` tests it).
const renamed = (
	await service.createDraft({
		collection: "post",
		slug: "renamed-post-old",
		metadata: { title: "A renamed post", categoryId: category.id, tagIds: [tagIds[0]] },
		format: "mdx",
		body: "This post was published under another address.",
	})
).entry;
const published = (await service.publish({ id: renamed.id, expectedVersion: renamed.version })).entry;
const moved = (
	await service.saveDraft(renamed.id, {
		collection: "post",
		slug: "renamed-post",
		metadata: { title: "A renamed post", categoryId: category.id, tagIds: [tagIds[0]] },
		format: "mdx",
		body: "This post was published under another address.",
		expectedVersion: published.version,
	})
).entry;
await service.publish({ id: renamed.id, expectedVersion: moved.version });

// Sample media assets for previewing the media library UI.
if (cms.isMediaConfigured) {
	const wallpapersFolder = await cms.store().createFolder({
		collection: "media",
		parentId: null,
		name: "Wallpapers",
	});
	const assetsFolder = await cms.store().createFolder({
		collection: "media",
		parentId: null,
		name: "Blog Assets",
	});

	const sampleMedia = [
		{
			filename: "nordic-forest.jpg",
			mimeType: "image/jpeg" as const,
			byteSize: 342150,
			width: 1920,
			height: 1280,
			storageKey: "photo-1448375240586-882707db888b?auto=format&fit=crop&w=1200&q=80",
			folderId: wallpapersFolder.id,
			defaultAlt: "Misty pine forest morning",
			defaultCaption: "Morning mist over Scandinavian pines",
		},
		{
			filename: "workspace-minimal.jpg",
			mimeType: "image/jpeg" as const,
			byteSize: 215400,
			width: 1920,
			height: 1280,
			storageKey: "photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=1200&q=80",
			folderId: wallpapersFolder.id,
			defaultAlt: "Clean workspace with MacBook and coffee",
			defaultCaption: "Minimal desk setup for writing",
		},
		{
			filename: "architecture-geometric.jpg",
			mimeType: "image/jpeg" as const,
			byteSize: 184200,
			width: 1600,
			height: 1067,
			storageKey: "photo-1513694203232-719a280e022f?auto=format&fit=crop&w=1200&q=80",
			folderId: assetsFolder.id,
			defaultAlt: "Modern concrete architectural geometry",
			defaultCaption: "Architectural lines and light",
		},
		{
			filename: "abstract-waves.jpg",
			mimeType: "image/jpeg" as const,
			byteSize: 420800,
			width: 1920,
			height: 1080,
			storageKey: "photo-1550684848-fac1c5b4e853?auto=format&fit=crop&w=1200&q=80",
			folderId: assetsFolder.id,
			defaultAlt: "Abstract fluid gradient waves",
			defaultCaption: "Iridescent color gradient background",
		},
		{
			filename: "cybersecurity-code.jpg",
			mimeType: "image/jpeg" as const,
			byteSize: 268400,
			width: 1920,
			height: 1080,
			storageKey: "photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=1200&q=80",
			folderId: null,
			defaultAlt: "Code matrix and cybersecurity concept",
			defaultCaption: "Code on screen visualization",
		},
	];

	for (const item of sampleMedia) {
		const created = await cms.store().createMediaAsset({
			filename: item.filename,
			mimeType: item.mimeType,
			byteSize: item.byteSize,
			stagingKey: `staging/${item.filename}`,
			folderId: item.folderId,
		});
		await cms.store().completeMediaAsset({
			id: created.id,
			storageKey: item.storageKey,
			mimeType: item.mimeType,
			byteSize: item.byteSize,
			width: item.width,
			height: item.height,
		});
		await cms.store().updateMediaMetadata({
			id: created.id,
			defaultAlt: item.defaultAlt,
			defaultCaption: item.defaultCaption,
		});
	}
}

const admin = (id: string) => `${origin}/studio/entries/${id}/edit`;
console.log("\nPublic pages");
console.log(`  ${origin}/ko/posts (list)`);
console.log(`  ${origin}/ko/posts/cms-elements`);
console.log(`  ${origin}/ko/posts/cms-elements-details`);
console.log(`  ${origin}/ko/memos (list)`);
console.log(`  ${origin}/ko/memos/showcase-memo`);
console.log("Admin editor (dev login bypass)");
console.log(`  ${admin(idOf("cms-elements"))}`);
console.log(`  ${admin(idOf("cms-elements-details"))}`);
console.log(`  ${admin(idOf("cms-elements-draft"))} (unpublished draft)`);
console.log(`  ${admin(idOf("showcase-memo"))} (memo)`);
console.log(`  ${admin(series.id)} (series)`);
console.log(`  ${origin}/studio (all content)`);
if (cms.isMediaConfigured) {
	console.log(`  ${origin}/studio/media (media library)`);
}

await cms.close();
