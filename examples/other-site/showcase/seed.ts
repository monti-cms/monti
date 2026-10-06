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

/** Creates a draft with a placeholder body, saves the real body, and publishes it (what the admin does when an editor writes and publishes). */
async function writeArticle(input: {
	slug: string;
	metadata: Record<string, unknown>;
	mdx: string;
	publish: boolean;
}): Promise<{ id: string }> {
	const created = await service.createDraft({
		collection: "article",
		slug: input.slug,
		metadata: input.metadata,
		mdx: "Placeholder body.",
	});
	const saved = await service.saveDraft(created.id, {
		collection: "article",
		slug: input.slug,
		metadata: input.metadata,
		mdx: input.mdx,
		expectedVersion: created.version,
	});
	if (!input.publish) return { id: saved.id };
	const { entry, warnings } = await service.publish({ id: saved.id, expectedVersion: saved.version });
	for (const warning of warnings) console.warn(`warning (${input.slug}): ${JSON.stringify(warning)}`);
	return { id: entry.id };
}

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
const elements = await writeArticle({
	slug: "cms-elements",
	metadata: { ...common, title: "CMS elements" },
	mdx: read("cms-elements.mdx"),
	publish: true,
});
const details = await writeArticle({
	slug: "cms-elements-details",
	metadata: { ...common, title: "CMS elements: details" },
	mdx: read("cms-elements-details.mdx"),
	publish: true,
});
const draft = await writeArticle({
	slug: "cms-elements-draft",
	metadata: { ...common, title: "CMS elements: unpublished draft" },
	mdx: "This draft is not published. It shows as a draft in the admin list and returns 404 on the public site.",
	publish: false,
});

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
