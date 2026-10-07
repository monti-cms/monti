import { describe, expect, it } from "vitest";
import { detectApp, parseFrontMatterKeys } from "../init-detect";
import { fixtureApp, POST_MDX, SRC_APP } from "./init-helpers";

describe("detecting the app", () => {
	it("reads a create-next-app project", () => {
		const app = detectApp(fixtureApp());
		expect(app).toMatchObject({
			packageName: "my-blog",
			next: "16.3.8",
			appDir: "app",
			src: false,
			hasAppRouter: true,
			pagesRouterOnly: false,
			packageManager: "pnpm",
			typescript: true,
			resolveJsonModule: true,
			tailwind: { installed: true, typography: false },
			contentFolders: [],
			nextConfig: "next.config.ts",
			devPort: 3000,
			envLocalIgnored: true,
			existingConfig: undefined,
			legacyConfig: [],
		});
	});

	it("finds src/app, a Tailwind typography plugin and the other package managers", () => {
		const pkg = JSON.stringify({
			name: "x",
			dependencies: { next: "16.0.0" },
			devDependencies: { tailwindcss: "^4", "@tailwindcss/typography": "^0.5" },
		});
		const app = detectApp(fixtureApp({ ...SRC_APP, "package.json": pkg, "pnpm-lock.yaml": null, "bun.lock": "" }));
		expect(app).toMatchObject({
			src: true,
			appDir: "src/app",
			packageManager: "bun",
			tailwind: { installed: true, typography: true },
		});
		expect(detectApp(fixtureApp({ "pnpm-lock.yaml": null, "package-lock.json": "{}" })).packageManager).toBe("npm");
		expect(detectApp(fixtureApp({ "pnpm-lock.yaml": null })).packageManager).toBe("npm");
		expect(
			detectApp(
				fixtureApp({
					"pnpm-lock.yaml": null,
					"package.json": '{"packageManager":"yarn@4.1.0","dependencies":{"next":"16"}}',
				}),
			).packageManager,
		).toBe("yarn");
	});

	it("knows a JavaScript app, a pages-only app and a missing tsconfig", () => {
		const js = detectApp(fixtureApp({ "tsconfig.json": null, "package.json": '{"dependencies":{"next":"16"}}' }));
		expect(js.typescript).toBe(false);
		expect(js.resolveJsonModule).toBeUndefined();
		const pages = detectApp(
			fixtureApp({ "app/layout.tsx": null, "app/page.tsx": null, "app/globals.css": null, "pages/index.js": "" }),
		);
		expect(pages).toMatchObject({ hasAppRouter: false, pagesRouterOnly: true });
	});

	it("finds Markdown and MDX folders and the front matter keys, most common first", () => {
		const app = detectApp(
			fixtureApp({
				"content/posts/a.mdx": POST_MDX("a"),
				"content/posts/b.md": "---\ntitle: B\ndraft: true\n---\nx\n",
				"content/notes/n.md": "no front matter\n",
				"content/readme.txt": "",
				"node_modules/pkg/readme.md": "# not content\n",
				"docs/guide.md": "# not in a content root\n",
			}),
		);
		expect(app.contentFolders.map((folder) => [folder.dir, folder.files])).toEqual([
			["content/notes", 1],
			["content/posts", 2],
		]);
		const posts = app.contentFolders.find((folder) => folder.dir === "content/posts");
		expect(posts?.keys[0]).toEqual({ name: "draft", count: 2, type: "boolean" });
		expect(posts?.keys.map((key) => key.name)).toEqual([
			"draft",
			"title",
			"author",
			"cover",
			"date",
			"description",
			"tags",
		]);
		expect(posts?.keys.find((key) => key.name === "tags")?.type).toBe("list");
		expect(posts?.keys.find((key) => key.name === "date")?.type).toBe("date");
	});

	it("reads an existing monti.config.ts and the earlier cms.config.ts", () => {
		expect(detectApp(fixtureApp({ "monti.config.ts": "" })).existingConfig).toBe("monti.config.ts");
		expect(detectApp(fixtureApp({ ...SRC_APP, "src/monti.config.ts": "" })).existingConfig).toBe("src/monti.config.ts");
		expect(detectApp(fixtureApp({ "cms.config.ts": "", "cms.server.ts": "" })).legacyConfig).toEqual([
			"cms.config.ts",
			"cms.server.ts",
		]);
	});

	it("reads the port from the dev script", () => {
		const pkg = (dev: string) => JSON.stringify({ dependencies: { next: "16" }, scripts: { dev } });
		expect(detectApp(fixtureApp({ "package.json": pkg("next dev -p 4000") })).devPort).toBe(4000);
		expect(detectApp(fixtureApp({ "package.json": pkg("next dev --turbopack --port=5000") })).devPort).toBe(5000);
	});

	it("notices a .gitignore that does not cover .env.local", () => {
		expect(detectApp(fixtureApp({ ".gitignore": "node_modules\n" })).envLocalIgnored).toBe(false);
		expect(detectApp(fixtureApp({ ".gitignore": ".env*.local\n" })).envLocalIgnored).toBe(true);
		expect(detectApp(fixtureApp({ ".gitignore": null })).envLocalIgnored).toBe(false);
	});
});

describe("front matter keys", () => {
	it("types the top-level keys and ignores nested ones and the body", () => {
		const keys = parseFrontMatterKeys(
			'---\ntitle: "Hello: world"\ncount: 3\nok: true\nwhen: 2024-02-03T10:00:00Z\ntags: [a, b]\nauthors:\n  - name: x\nnested:\n  inner: 1\n---\nbody: not a key\n',
		);
		expect([...keys]).toEqual([
			["title", "string"],
			["count", "number"],
			["ok", "boolean"],
			["when", "date"],
			["tags", "list"],
			["authors", "list"],
			["nested", "string"],
		]);
		expect(parseFrontMatterKeys("# no front matter\n").size).toBe(0);
		expect(parseFrontMatterKeys("﻿---\r\ntitle: x\r\n---\r\n").has("title")).toBe(true);
	});
});
