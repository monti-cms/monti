/**
 * Seeds the showcase articles into the database the example app points at (`CMS_DATABASE_URL`, `CMS_SCHEMA`), through the app's own write path
 * (`cms.contentService()`: create, save, publish). It is run by `pnpm preview:example` (`scripts/preview-example.mjs`) from this app's folder:
 *
 *   pnpm exec tsx --env-file=.env.local --import @monti-cms/core/register showcase/seed.ts <port>
 *
 * It writes an author, a topic, two published articles (`cms-elements` and `cms-elements-details`) and one unpublished draft, then prints
 * the public and the admin URLs. Publishing runs the same checks as the admin, so a body that has issues stops the seed.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { cms } from "../cms.server";

const port = process.argv[2] ?? "3997";
const origin = `http://localhost:${port}`;
const read = (file: string) => readFileSync(fileURLToPath(new URL(file, import.meta.url)), "utf8");

const service = cms.contentService();

const author = await service.createDraft({
	collection: "author",
	slug: "showcase-author",
	metadata: { title: "Showcase Author", bio: "Writes the sample articles that are checked on screen." },
	mdx: "",
});
const topic = await service.createDraft({
	collection: "topic",
	slug: "showcase",
	metadata: { title: "Showcase" },
	mdx: "",
});

const common = { authorId: author.id, topicIds: [topic.id], format: "guide" };
const articles = [
	{
		slug: "cms-elements",
		metadata: { ...common, title: "CMS elements" },
		mdx: read("cms-elements.mdx"),
		publish: true,
	},
	{
		slug: "cms-elements-details",
		metadata: { ...common, title: "CMS elements: details" },
		mdx: read("cms-elements-details.mdx"),
		publish: true,
	},
	{
		slug: "cms-elements-draft",
		metadata: { ...common, title: "CMS elements: unpublished draft" },
		mdx: "This draft is not published. It shows as a draft in the admin list and returns 404 on the public site.",
		publish: false,
	},
];

// The articles link to each other, and a link to a page is stored as the id of that page when the body is saved. So every draft is created first,
// then every body is saved (each link finds its page), and only then are the articles published.
const created = await Promise.all(
	articles.map(async (article) => ({
		article,
		draft: await service.createDraft({
			collection: "article",
			slug: article.slug,
			metadata: article.metadata,
			mdx: "Placeholder body.",
		}),
	})),
);
const saved = [];
for (const { article, draft } of created) {
	const entry = await service.saveDraft(draft.id, {
		collection: "article",
		slug: article.slug,
		metadata: article.metadata,
		mdx: article.mdx,
		expectedVersion: draft.version,
	});
	saved.push({ article, id: entry.id, version: entry.version });
}
for (const { article, id, version } of saved) {
	if (!article.publish) continue;
	const { warnings } = await service.publish({ id, expectedVersion: version });
	for (const warning of warnings) console.warn(`warning (${article.slug}): ${JSON.stringify(warning)}`);
}
const idOf = (slug: string) => saved.find((item) => item.article.slug === slug)?.id ?? "";
const elements = { id: idOf("cms-elements") };
const details = { id: idOf("cms-elements-details") };
const draft = { id: idOf("cms-elements-draft") };

const admin = (id: string) => `${origin}/studio/entries/${id}/edit`;
console.log("\nPublic pages");
console.log(`  ${origin}/en/blog/cms-elements`);
console.log(`  ${origin}/en/blog/cms-elements-details`);
console.log(`  ${origin}/en/blog (list)`);
console.log("Admin editor (dev login bypass)");
console.log(`  ${admin(elements.id)}`);
console.log(`  ${admin(details.id)}`);
console.log(`  ${admin(draft.id)} (unpublished draft)`);
console.log(`  ${origin}/studio (all content)`);

await cms.close();
