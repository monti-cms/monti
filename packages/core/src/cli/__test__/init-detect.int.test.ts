import { mkdirSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { detectApp } from "../init-detect";
import { detectAppDir } from "../next-app";
import { fixtureApp, POST_MDX, SRC_APP } from "./init-helpers";

describe("detectAppDir", () => {
	const dirWith = (...folders: string[]) => {
		const dir = mkdtempSync(path.join(tmpdir(), "monti-appdir-"));
		for (const folder of folders) mkdirSync(path.join(dir, folder), { recursive: true });
		return dir;
	};

	it("INIT-R2 prefers the folders that exist: src/app, then app", () => {
		expect(detectAppDir(dirWith("src/app", "app"))).toMatchObject({ dir: "src/app", exists: true });
		expect(detectAppDir(dirWith("app"))).toMatchObject({ dir: "app", exists: true });
	});

	it("DOC-R4 is what detectApp reports, so init and doctor look in the same place", () => {
		const cwd = fixtureApp({ ...SRC_APP });
		expect(detectApp(cwd).appDir).toBe(detectAppDir(cwd).dir);
	});
});

describe("detecting the app", () => {
	it("INIT-R2 reads a create-next-app project", () => {
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
			contentFolders: [],
			nextConfig: "next.config.ts",
			devPort: 3000,
			existingConfig: undefined,
		});
	});

	it("INIT-I1 finds src/app and the other package managers", () => {
		const pkg = JSON.stringify({
			name: "x",
			dependencies: { next: "16.0.0" },
		});
		const app = detectApp(fixtureApp({ ...SRC_APP, "package.json": pkg, "pnpm-lock.yaml": null, "bun.lock": "" }));
		expect(app).toMatchObject({
			src: true,
			appDir: "src/app",
			packageManager: "bun",
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

	it("INIT-K7 knows a JavaScript app, a pages-only app and a missing tsconfig", () => {
		const js = detectApp(fixtureApp({ "tsconfig.json": null, "package.json": '{"dependencies":{"next":"16"}}' }));
		expect(js.typescript).toBe(false);
		const pages = detectApp(
			fixtureApp({ "app/layout.tsx": null, "app/page.tsx": null, "app/globals.css": null, "pages/index.js": "" }),
		);
		expect(pages).toMatchObject({ hasAppRouter: false, pagesRouterOnly: true });
	});

	it("INIT-C1 finds Markdown and MDX folders and the front matter keys, most common first", () => {
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

	it("reads an existing monti.config.ts", () => {
		expect(detectApp(fixtureApp({ "monti.config.ts": "" })).existingConfig).toBe("monti.config.ts");
		expect(detectApp(fixtureApp({ ...SRC_APP, "src/monti.config.ts": "" })).existingConfig).toBe("src/monti.config.ts");
	});

	it("INIT-N1 reads the port from the dev script", () => {
		const pkg = (dev: string) => JSON.stringify({ dependencies: { next: "16" }, scripts: { dev } });
		expect(detectApp(fixtureApp({ "package.json": pkg("next dev -p 4000") })).devPort).toBe(4000);
		expect(detectApp(fixtureApp({ "package.json": pkg("next dev --turbopack --port=5000") })).devPort).toBe(5000);
	});
});
