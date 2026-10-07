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
const category = await service.createDraft({
	collection: "category",
	slug: "showcase",
	metadata: { title: "Showcase" },
	format: "mdx",
	body: "",
});
const tags = await Promise.all(
	[
		{ slug: "monti", title: "Monti" },
		{ slug: "blocks", title: "Blocks" },
	].map(({ slug, title }) =>
		service.createDraft({ collection: "tag", slug, metadata: { title }, format: "mdx", body: "" }),
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
		draft: await service.createDraft({
			collection: entry.collection,
			slug: entry.slug,
			metadata: entry.metadata,
			format: "mdx",
			body: "Placeholder body.",
		}),
	})),
);
const saved: { entry: Entry; id: string; version: number }[] = [];
for (const { entry, draft } of created) {
	const result = await service.saveDraft(draft.id, {
		collection: entry.collection,
		slug: entry.slug,
		metadata: entry.metadata,
		format: "mdx",
		body: entry.mdx,
		expectedVersion: draft.version,
	});
	saved.push({ entry, id: result.id, version: result.version });
}
const idOf = (slug: string) => saved.find((item) => item.entry.slug === slug)?.id ?? "";

// The series holds both published posts, in order.
const series = await service.createDraft({
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
});

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

await cms.close();
