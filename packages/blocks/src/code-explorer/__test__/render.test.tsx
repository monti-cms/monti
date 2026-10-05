import { directiveSyntax } from "@monti-cms/syntax-directive";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

// Public components come from the plugin (`blocks()`), so this test swaps in a config that uses it.
vi.mock("../../../../core/src/config/resolved", async () => ({
	cmsConfig: (await import("../../test/render-config")).default,
}));

const { renderMdx } = await import("@monti-cms/core/render");

const html = async (source: string, locale?: string, syntax?: Parameters<typeof renderMdx>[1]) =>
	renderToStaticMarkup((await renderMdx(source, { locale, ...syntax })).content);

const fence = (title: string, code = "") => `\`\`\`ts title="${title}"\n${code}${code ? "\n" : ""}\`\`\``;
const explorer = (blocks: readonly string[], open?: string) =>
	`<CodeExplorer${open ? ` open="${open}"` : ""}>\n\n${blocks.join("\n\n")}\n\n</CodeExplorer>`;

/** The file panels of the markup, with their entry index, `hidden` state and body. */
const panels = (markup: string) =>
	Array.from(
		markup.matchAll(
			/<div class="cms-block-code-explorer-panel" data-code-explorer-panel="(\d+)"( hidden="")?>(.*?)<\/div><\/div>/g,
		),
		(match) => ({ index: Number(match[1]), hidden: match[2] !== undefined, body: match[3] ?? "" }),
	);
const shownPanel = (markup: string) => panels(markup).filter((panel) => !panel.hidden);

describe("code explorer public component", () => {
	it("renders every file in the page and hides all but the first file that has code", async () => {
		const markup = await html(explorer([fence("src/a.ts", "const a = 1;"), fence("src/b.ts", "const b = 2;")]));
		expect(panels(markup)).toHaveLength(2);
		expect(markup).toContain('data-title="src/a.ts"');
		expect(markup).toContain('data-title="src/b.ts"');
		const shown = shownPanel(markup);
		expect(shown).toHaveLength(1);
		expect(shown[0]?.body).toContain('data-title="src/a.ts"');
		// The original code block keeps its title row, highlighting and copy button.
		expect(shown[0]?.body).toContain("cms-code-copy");
	});

	it("shows the file named by `open`, ignoring a leading ./ and falling back to the first file for an unknown path", async () => {
		const blocks = [fence("a.ts", "a"), fence("src/b.ts", "b"), fence("c.ts", "c")];
		expect(shownPanel(await html(explorer(blocks, "src/b.ts")))[0]?.body).toContain('data-title="src/b.ts"');
		expect(shownPanel(await html(explorer(blocks, "./src/b.ts")))[0]?.body).toContain('data-title="src/b.ts"');
		expect(shownPanel(await html(explorer(blocks, "nope.ts")))[0]?.body).toContain('data-title="a.ts"');
		// A tree-only file cannot be opened, so the first file with code is shown.
		const treeOnly = await html(explorer([fence("a.ts"), fence("b.ts", "b")], "a.ts"));
		expect(shownPanel(treeOnly)[0]?.body).toContain('data-title="b.ts"');
	});

	it("builds the tree in the author's order with folders, marks the shown file and the roving tab stop", async () => {
		const markup = await html(
			explorer(
				[fence("src/app/page.tsx", "p"), fence("package.json", "{}"), fence("src/lib/db.ts", "d")],
				"package.json",
			),
		);
		expect(markup).toContain('role="tree"');
		expect(markup).toContain('aria-label="Files"');
		const names = Array.from(markup.matchAll(/cms-block-code-explorer-label">([^<]+)</g), (match) => match[1]);
		expect(names).toEqual(["src", "app", "page.tsx", "lib", "db.ts", "package.json"]);
		expect(markup).toMatch(/data-path="src" data-kind="folder"[^>]*aria-expanded="true"/);
		expect(markup).toMatch(/data-path="package.json"[^>]*aria-selected="true" tabindex="0"/);
		expect(markup.match(/tabindex="0"/g)).toHaveLength(1);
	});

	it("lists a file with no code and a folder entry in the tree without a panel", async () => {
		const markup = await html(explorer([fence("a.ts", "a"), fence("notes.md"), fence("public/")]));
		expect(panels(markup)).toHaveLength(1);
		expect(markup).toMatch(/data-path="notes.md"[^>]*aria-disabled="true"/);
		expect(markup).not.toMatch(/data-path="notes.md"[^>]*aria-selected/);
		expect(markup).toMatch(/data-path="public" data-kind="folder"/);
		// A tree-only file is not rendered as a code block of its own.
		expect(markup).not.toContain('data-title="notes.md"');
	});

	it("renders only the tree when no file has code", async () => {
		const markup = await html(explorer([fence("a.ts"), fence("src/")]));
		expect(markup).toContain('role="tree"');
		expect(markup).not.toContain("cms-block-code-explorer-panel");
		expect(markup).not.toContain("cms-block-code-explorer-toggle");
	});

	it("keeps children that are not titled code blocks after the explorer", async () => {
		const markup = await html(
			explorer(["Intro text", "```ts\nuntitled();\n```", fence("a.ts", "a"), "<Callout>\n\nNote\n\n</Callout>"]),
		);
		const explorerEnd = markup.indexOf("</div></div><p>");
		expect(explorerEnd).toBeGreaterThan(0);
		const after = markup.slice(explorerEnd);
		expect(after).toContain("Intro text");
		expect(after).toContain("untitled");
		expect(after).toContain("cms-block-callout");
		expect(markup.slice(0, explorerEnd)).not.toContain("untitled");
	});

	it("renders the children as they are when no code block has a path", async () => {
		const markup = await html(explorer(["Just text", "```ts\ncode();\n```"]));
		expect(markup).not.toContain("cms-block-code-explorer");
		expect(markup).toContain("<p>Just text</p>");
		expect(markup).toContain("code");
	});

	it("keeps the first of two blocks with one path in the tree and renders the later one after the explorer", async () => {
		const markup = await html(explorer([fence("a.ts", "first();"), fence("./a.ts", "second();"), fence("b.ts", "b")]));
		expect(markup.match(/data-path="a.ts"/g)).toHaveLength(1);
		expect(panels(markup)).toHaveLength(2);
		expect(markup).toContain("first");
		expect(markup).toContain("second");
		expect(shownPanel(markup)[0]?.body).toContain("first");
		expect(panels(markup).some((panel) => panel.body.includes("second"))).toBe(false);
	});

	it("drops a duplicate or conflicting block that has no code, since it holds nothing", async () => {
		const markup = await html(explorer([fence("a.ts", "a"), fence("a.ts"), fence("a.ts/")]));
		expect(markup.match(/data-path="a.ts"/g)).toHaveLength(1);
		expect(panels(markup)).toHaveLength(1);
		expect(markup.endsWith("</div></div></div>")).toBe(true);
	});

	it("uses the site language for the tree name and the narrow screen button hint", async () => {
		const markup = await html(explorer([fence("a.ts", "a")]), "ko");
		expect(markup).toContain('aria-label="파일"');
		expect(markup).toContain('title="파일 목록 열기 또는 닫기"');
		expect(await html(explorer([fence("a.ts", "a")]), "ja")).toContain('aria-label="ファイル"');
	});

	it("renders the directive form like the JSX form", async () => {
		const source = ':::code-explorer{open="b.ts"}\n```ts title="a.ts"\na();\n```\n```ts title="b.ts"\nb();\n```\n:::';
		const markup = await html(source, undefined, { syntax: [directiveSyntax()] });
		expect(panels(markup)).toHaveLength(2);
		expect(shownPanel(markup)[0]?.body).toContain('data-title="b.ts"');
	});
});
