import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { defineSite } from "@monti-cms/core";
import { type ImportReport, initProject, runImport } from "@monti-cms/core/cli";
import { createCms, postgres } from "@monti-cms/core/server";
import { closeGlobalPool, createIsolatedTestPool, dropIsolatedTestPool, type Entry } from "@monti-cms/core/testing";
import { mdx } from "@monti-cms/mdx";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { adminAuth } from "./import-harness";

/**
 * The newcomer path from one end to the other, with the files a person has: a Next app with a folder of posts, `monti init --yes` (with the blog theme), then
 * `monti import`. What init wrote, what import fills and what the theme serves must agree: every tag is set, the date is the publish date, and the links between
 * posts point to routes the theme has pages for.
 *
 * (The `.blog.test.ts` name keeps the other-site rerun from running it again: it brings its own schema.)
 */

const POSTS = {
	"hello.md": `---
title: Hello World
date: 2024-03-01
description: The first post.
tags: [web, next]
category: guides
---

Read the [second post](./second.md) next, or the [third](/{base}/third) one. Also see [the docs](https://example.com/docs).
`,
	"second.md": `---
title: Second Post
date: 2024-04-02
description: The second post.
tags: [web]
category: notes
---

Back to the [first post](./hello.md).
`,
	"third.md": `---
title: Third Post
date: 2024-05-03
description: The third post.
tags: [next, extra]
category: guides
---

Nothing to link here.
`,
};

const APP_FILES = {
	"package.json": JSON.stringify({
		name: "newcomer-blog",
		dependencies: { next: "16.3.8", react: "19.2.3", "react-dom": "19.2.3" },
		devDependencies: { typescript: "^5", tailwindcss: "^4", "@tailwindcss/typography": "^0.5.0" },
	}),
	"tsconfig.json": JSON.stringify({ compilerOptions: { resolveJsonModule: true, paths: { "@/*": ["./*"] } } }),
	"next.config.ts":
		'import type { NextConfig } from "next";\n\nconst nextConfig: NextConfig = {};\n\nexport default nextConfig;\n',
	".gitignore": "node_modules\n.env*.local\n",
	"app/page.tsx": "export default function Page() { return null; }\n",
};

const write = (dir: string, files: Record<string, string>) => {
	for (const [file, content] of Object.entries(files)) {
		mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
		writeFileSync(path.join(dir, file), content);
	}
};

const allEntries = async (cms: ReturnType<typeof createCms>, collection: string): Promise<Entry[]> => {
	const store = cms.store();
	const list = await store.listEntries({ collection, pageSize: 100 });
	return Promise.all(list.items.map((item) => store.getEntry(item.id)));
};

/** `app/(site)/blog/[slug]/page.tsx` -> a matcher for `/blog/<slug>`. */
const routeMatcher = (pageFile: string): RegExp => {
	const route = pageFile
		.replace(/^(?:src\/)?app\//, "")
		.replace(/\/page\.tsx$/, "")
		.split("/")
		.filter((segment) => !/^\(.*\)$/.test(segment))
		.map((segment) => (/^\[[^\]]+\]$/.test(segment) ? "[^/]+" : segment.replace(/[.*+?^${}()|\\]/g, "\\$&")))
		.join("/");
	return new RegExp(`^/${route}$`);
};

describe.each([
	{ folder: "blog", base: "/blog" },
	{ folder: "posts", base: "/posts" },
])("init --yes, then import, then the theme: content/$folder", ({ folder, base }) => {
	let dir: string;
	let pool: Awaited<ReturnType<typeof createIsolatedTestPool>>["pool"];
	let schemaName: string;
	let cms: ReturnType<typeof createCms>;
	let report: ImportReport;
	let schema: {
		collections: Record<string, { kind: string; path?: string; fields: Record<string, Record<string, unknown>> }>;
	};

	beforeAll(async () => {
		dir = mkdtempSync(path.join(tmpdir(), "monti-newcomer-"));
		write(dir, APP_FILES);
		write(
			dir,
			Object.fromEntries(
				Object.entries(POSTS).map(([name, text]) => [`content/${folder}/${name}`, text.replace("{base}", folder)]),
			),
		);

		// `monti init --yes --blog-theme` (nothing is installed, nothing is migrated: this is about what it writes).
		const initReport = await initProject({
			cwd: dir,
			host: { install: () => undefined, migrate: async () => true },
			env: {},
			database: "skip",
			blogTheme: true,
			install: true,
		});
		expect(initReport.ok).toBe(true);
		schema = JSON.parse(readFileSync(path.join(dir, "monti.schema.json"), "utf8"));

		// The site init described, on a database of its own.
		const isolated = await createIsolatedTestPool();
		pool = isolated.pool;
		schemaName = isolated.schemaName;
		cms = createCms({
			config: defineSite({ schema: schema as never, plugins: [mdx()] } as never),
			server: {
				database: postgres({ connectionString: process.env.CMS_TEST_DATABASE_URL, schema: schemaName }),
				auth: { name: "test", create: adminAuth },
				secret: "a-long-test-secret-for-the-newcomer-test",
			},
		});
		await cms.migrate({ log: () => undefined });

		// `monti import content/<folder> --yes --publish`: no prompter, so every question takes its default.
		report = await runImport({
			cms,
			cwd: dir,
			target: `content/${folder}`,
			mappingFile: path.join(dir, "monti.import.json"),
			publish: true,
		});
	});

	afterAll(async () => {
		await cms?.close();
		if (pool && schemaName) await dropIsolatedTestPool(pool, schemaName);
		await closeGlobalPool();
		if (dir) rmSync(dir, { recursive: true, force: true });
	});

	it("init wrote the tag and category collections, the relations, the summary field and a path that matches the folder", () => {
		expect(Object.keys(schema.collections)).toEqual(["post", "tag", "category"]);
		expect(schema.collections.post?.path).toBe(`${base}/:slug`);
		const fields = schema.collections.post?.fields ?? {};
		expect(fields.tagIds).toMatchObject({ kind: "relation", to: "tag", many: true });
		expect(fields.categoryId).toMatchObject({ kind: "relation", to: "category" });
		expect(fields.description).toMatchObject({ kind: "text", role: "summary" });
		// `date` is not a field: it is the publish date of the entry.
		expect(fields).not.toHaveProperty("date");
	});

	it("import took every file without a warning, and mapped the date to the publish date", () => {
		expect(report.counts).toEqual({ imported: 3, updated: 0, skipped: 0, failed: 0 });
		expect(report.files.flatMap((file) => file.notices)).toEqual([]);
		expect(report.mapping.folders[`content/${folder}`]).toMatchObject({
			collection: "post",
			fields: {
				date: "@publishedAt",
				description: "description",
				tags: { field: "tagIds", create: true },
				category: { field: "categoryId", create: true },
			},
		});
		// The mapping file names the folder by its real path, not ".".
		expect(Object.keys(JSON.parse(readFileSync(path.join(dir, "monti.import.json"), "utf8")).folders)).toEqual([
			`content/${folder}`,
		]);
	});

	it("every tag and category is set on its post, as entries of their collections", async () => {
		const posts = await allEntries(cms, "post");
		const tags = await allEntries(cms, "tag");
		const categories = await allEntries(cms, "category");
		expect(tags.map((tag) => tag.workingSlug).sort()).toEqual(["extra", "next", "web"]);
		expect(categories.map((category) => category.workingSlug).sort()).toEqual(["guides", "notes"]);

		const byTitle = Object.fromEntries(posts.map((post) => [post.working.metadata.title as string, post]));
		const slugsOf = (post: Entry | undefined, name: "tagIds" | "categoryId", entries: Entry[]) => {
			const value = post?.working.metadata[name];
			const ids = Array.isArray(value) ? (value as string[]) : value ? [value as string] : [];
			return ids.map((id) => entries.find((entry) => entry.id === id)?.workingSlug).sort();
		};
		expect(slugsOf(byTitle["Hello World"], "tagIds", tags)).toEqual(["next", "web"]);
		expect(slugsOf(byTitle["Second Post"], "tagIds", tags)).toEqual(["web"]);
		expect(slugsOf(byTitle["Third Post"], "tagIds", tags)).toEqual(["extra", "next"]);
		expect(slugsOf(byTitle["Hello World"], "categoryId", categories)).toEqual(["guides"]);
		expect(slugsOf(byTitle["Second Post"], "categoryId", categories)).toEqual(["notes"]);
		for (const post of posts) {
			expect(post.working.metadata.description).toMatch(/post\.$/);
			expect(post.working.metadata).not.toHaveProperty("date");
		}
	});

	it("the dates are the publish dates", async () => {
		const posts = await allEntries(cms, "post");
		const dates = Object.fromEntries(
			posts.map((post) => [post.working.metadata.title as string, post.publishedAt?.toISOString().slice(0, 10)]),
		);
		expect(dates).toEqual({ "Hello World": "2024-03-01", "Second Post": "2024-04-02", "Third Post": "2024-05-03" });
		expect(posts.every((post) => post.status === "published")).toBe(true);
	});

	it("the blog theme serves the routes the schema's path produces, and its config names the fields init made", () => {
		const config = readFileSync(path.join(dir, "components/monti/blog-theme/theme.config.ts"), "utf8");
		expect(config).toContain('collection: "post",');
		expect(config).toContain(`routeBase: "${base}",`);
		expect(config).toContain('excerptField: "description",');
		expect(config).toContain('topicsField: "tagIds",');
		expect(config).toContain("authorField: undefined,");
		expect(existsSync(path.join(dir, `app/(site)/${base.slice(1)}/page.tsx`))).toBe(true);
		expect(existsSync(path.join(dir, `app/(site)/${base.slice(1)}/[slug]/page.tsx`))).toBe(true);
		expect(existsSync(path.join(dir, `app/(site)/preview/${base.slice(1)}/[slug]/page.tsx`))).toBe(true);
		// The theme has no page at the other folder's route.
		const other = base === "/blog" ? "posts" : "blog";
		expect(existsSync(path.join(dir, `app/(site)/${other}`))).toBe(false);
	});

	it("the links between posts point to routes the theme has pages for", async () => {
		const routes = routeMatcher(`app/(site)/${base.slice(1)}/[slug]/page.tsx`);
		const slugs = new Set((await allEntries(cms, "post")).map((post) => String(post.workingSlug)));

		let followed = 0;
		for (const slug of slugs) {
			const found = await cms.read.getEntry({ collection: "post", slug });
			if (found.status !== "found") throw new Error(`${slug} is not published`);
			// The entry itself is listed at a route of the theme too.
			expect(found.entry.path).toMatch(routes);
			for (const link of Object.values(found.entry.refs.links)) {
				expect(link.path).toMatch(routes);
				expect(slugs.has(String(link.path).split("/").pop() ?? "")).toBe(true);
				followed++;
			}
		}
		// hello -> second, third; second -> hello. The outside link stays an address.
		expect(followed).toBe(3);
	});
});
