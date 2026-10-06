// @vitest-environment jsdom
import { CmsAdminComponentsProvider, useCmsAdminComponents, useFormat } from "@monti-cms/admin";
import { CmsApiError } from "@monti-cms/admin/api";
import {
	contentPath,
	createTranslator,
	DEFAULT_LOCALE,
	LINKABLE_COLLECTIONS,
	localizePath,
} from "@monti-cms/core/client";
import { isBlockId, type StoredDocument, unparsedDocument } from "@monti-cms/core/document";
import { cleanup, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import type { Root } from "mdast";
import { useState } from "react";
import { visit } from "unist-util-visit";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SyntaxExtension } from "../syntax";
import { docOfMdx as docOf } from "../testing";
import { mdxBrowserFormat } from "./format";
import { mdxSourceMessages } from "./messages";
import { MdxAdminProvider } from "./provider";
import { lineOfBlock, MdxSourcePanel } from "./source-panel";

const mocks = vi.hoisted(() => ({ cmsFetch: vi.fn(), syntax: [] as readonly unknown[] }));

// The lookups of the entries a link points to go through the admin API; the panel reads the answers the test gives.
vi.mock("@monti-cms/admin/api", async (importOriginal) => ({
	...(await importOriginal<typeof import("@monti-cms/admin/api")>()),
	cmsFetch: mocks.cmsFetch,
}));

// The syntax extensions the site gave to `mdx({ syntax })`.
vi.mock("../syntax-config", async (importOriginal) => ({
	...(await importOriginal<typeof import("../syntax-config")>()),
	configuredSyntax: () => mocks.syntax,
}));

const mdxOfDoc = (doc: StoredDocument): string => mdxBrowserFormat.export(doc);

const t = createTranslator(mdxSourceMessages);

afterEach(cleanup);

const textarea = () => screen.getByRole("textbox", { name: t("body") }) as HTMLTextAreaElement;
const type = (value: string) => fireEvent.change(textarea(), { target: { value } });

describe("the MDX source panel", () => {
	const body = docOf("첫째 문단\n\n둘째 문단\n");

	it("shows the document as MDX text", () => {
		render(<MdxSourcePanel doc={body} onChange={() => {}} />);
		expect(textarea().value).toBe(mdxOfDoc(body));
		expect(textarea().value).toBe("첫째 문단\n\n둘째 문단\n");
	});

	it("parses what is typed in the browser and hands the document back, its blocks keeping the ids of the blocks they pair with", () => {
		const onChange = vi.fn();
		render(<MdxSourcePanel doc={body} onChange={onChange} />);
		type("첫째 문단\n\n둘째 문단 고침\n\n셋째\n");

		const [doc, issues] = onChange.mock.calls.at(-1) as [StoredDocument, unknown[]];
		expect(issues).toEqual([]);
		expect(doc.content.map((block) => block.type)).toEqual(["paragraph", "paragraph", "paragraph"]);
		// The unchanged block is the same block; the edited one pairs with its old self; the new one gets an id of its own.
		expect(doc.content[0]?.id).toBe(body.content[0]?.id);
		expect(doc.content[1]?.id).toBe(body.content[1]?.id);
		expect(isBlockId(doc.content[2]?.id)).toBe(true);
		expect(body.content.map((block) => block.id)).not.toContain(doc.content[2]?.id);
	});

	it("hands back a text it cannot read as a document that holds the text, with what was found", () => {
		const onChange = vi.fn();
		render(<MdxSourcePanel doc={body} onChange={onChange} />);
		const broken = "첫째 문단\n\n<Component>";
		type(broken);

		const [doc, issues] = onChange.mock.calls.at(-1) as [StoredDocument, { code: string; position?: unknown }[]];
		expect(doc.content).toHaveLength(1);
		expect(doc.content[0]).toMatchObject({ type: "unparsed", attrs: { source: broken } });
		expect(issues.length).toBeGreaterThan(0);
		expect(issues[0]?.code).toBe("mdx_error");
		expect(issues[0]?.position).toBeDefined();
		expect(textarea().getAttribute("aria-invalid")).toBe("true");
	});

	it("keeps the text as typed while the document it hands back comes round again", () => {
		function Host() {
			const [doc, setDoc] = useState(body);
			return <MdxSourcePanel doc={doc} onChange={setDoc} />;
		}
		render(<Host />);
		// "**" typed alone is text; the panel must not rewrite the field under the caret when the document comes back.
		type("첫째 문단\n\n둘째 *\n");
		expect(textarea().value).toBe("첫째 문단\n\n둘째 *\n");
		type("첫째 문단\n\n둘째 **굵게**\n");
		expect(textarea().value).toBe("첫째 문단\n\n둘째 **굵게**\n");
	});

	it("shows another document when the body changes from outside (a template, the visual editor)", () => {
		const { rerender } = render(<MdxSourcePanel doc={body} onChange={() => {}} />);
		rerender(<MdxSourcePanel doc={docOf("## 회고\n")} onChange={() => {}} />);
		expect(textarea().value).toBe("## 회고\n");
	});

	it("reports what is wrong with a body that could not be read when it opens, without changing the body", () => {
		const onChange = vi.fn();
		const unreadable = unparsedDocument("# 제목\n\n<Component>", null, "mdx");
		render(<MdxSourcePanel doc={unreadable} onChange={onChange} />);
		expect(textarea().value).toBe("# 제목\n\n<Component>");
		expect(textarea().getAttribute("aria-invalid")).toBe("true");
		const [doc, issues] = onChange.mock.calls.at(-1) as [StoredDocument, { code: string }[]];
		// The same document, so the editor does not count it as an edit.
		expect(doc).toBe(unreadable);
		expect(issues[0]?.code).toBe("mdx_error");
	});

	it("does not edit a body that cannot be edited, and tells the screen about IME composition", () => {
		const onComposing = vi.fn();
		render(<MdxSourcePanel doc={body} onChange={() => {}} readOnly onComposing={onComposing} />);
		expect(textarea().readOnly).toBe(true);
		fireEvent.compositionStart(textarea());
		fireEvent.compositionEnd(textarea());
		expect(onComposing.mock.calls).toEqual([[true], [false]]);
	});

	it("brings the caret to the start of a block when asked", async () => {
		const { rerender } = render(<MdxSourcePanel doc={body} onChange={() => {}} />);
		rerender(<MdxSourcePanel doc={body} onChange={() => {}} focusBlock={body.content[1]?.id} />);
		await waitFor(() => expect(document.activeElement).toBe(textarea()));
		expect(textarea().selectionStart).toBe("첫째 문단\n\n".length);
	});

	describe("lineOfBlock", () => {
		it("is the line of the text a top-level block starts on, and for a block inside another, the line of the one that holds it", () => {
			const doc = docOf("# 제목\n\n> 인용\n> 둘째 줄\n\n마지막\n");
			const lines = mdxOfDoc(doc).split("\n");
			for (const block of doc.content) {
				const line = lineOfBlock(doc, block.id as string) as number;
				expect(line).toBeGreaterThan(0);
				const first = JSON.stringify(block).includes("제목")
					? "# 제목"
					: JSON.stringify(block).includes("인용")
						? "> 인용"
						: "마지막";
				expect(lines[line - 1]).toBe(first);
			}
			const inner = doc.content[1]?.content?.[0]?.id as string;
			expect(lineOfBlock(doc, inner)).toBe(lineOfBlock(doc, doc.content[1]?.id as string));
		});

		it("is null for a block the document does not have, and the first line for a body that could not be read", () => {
			expect(lineOfBlock(docOf("문단"), "zzzzzzzz")).toBeNull();
			expect(lineOfBlock(unparsedDocument("<A>", null, "mdx"), "zzzzzzzz")).toBe(1);
		});
	});
});

describe("internal links in the source text", () => {
	const COLLECTION = LINKABLE_COLLECTIONS[0] as string;
	const PATH = localizePath(DEFAULT_LOCALE, contentPath(COLLECTION, "details") as string);
	// Every test links to an entry of its own: the editor remembers what it looked up, so a shared id would carry an answer from one test to the next.
	let counter = 0;
	let ID = "";
	const linked = () => docOf(`앞 [상세 글](entry:${ID}) 뒤\n`);
	const answerFound = () =>
		mocks.cmsFetch.mockResolvedValue({
			id: ID,
			collection: COLLECTION,
			status: "published",
			locale: DEFAULT_LOCALE,
			workingSlug: "details",
			publishedSlug: "details",
			working: { metadata: { title: "상세" } },
		});
	const answerMissing = () =>
		mocks.cmsFetch.mockRejectedValue(new CmsApiError(404, "not_found", "not found", [], { code: "not_found" }));

	beforeEach(() => {
		counter += 1;
		ID = `6f1c0b0e-3c1d-4a0e-9f5a-${String(counter).padStart(12, "0")}`;
		mocks.cmsFetch.mockReset();
	});

	it("are written with the entry's address once it is looked up, not as entry:<id>", async () => {
		answerFound();
		render(<MdxSourcePanel doc={linked()} onChange={() => {}} />);
		await waitFor(() => expect(textarea().value).toContain(`[상세 글](${PATH})`));
		expect(textarea().value).not.toContain("entry:");
	});

	it("keep entry:<id> when the entry cannot be resolved", async () => {
		answerMissing();
		render(<MdxSourcePanel doc={linked()} onChange={() => {}} />);
		await waitFor(() => expect(mocks.cmsFetch).toHaveBeenCalled());
		expect(textarea().value).toContain(`(entry:${ID})`);
	});

	it("an address typed for the entry already linked stays that link; any other typed path stays an href for the server", async () => {
		answerFound();
		const onChange = vi.fn();
		render(<MdxSourcePanel doc={linked()} onChange={onChange} />);
		await waitFor(() => expect(textarea().value).toContain(PATH));
		type(`앞 [상세 글](${PATH}) 뒤 [다른](/en/blog/other/)\n`);
		const [doc] = onChange.mock.calls.at(-1) as [StoredDocument];
		const marks = (doc.content[0]?.content ?? []).flatMap((node) => node.marks ?? []);
		expect(marks.map((mark) => mark.attrs)).toEqual([{ entryId: ID }, { href: "/en/blog/other/" }]);
	});
});

describe("registering the source panel and the format", () => {
	// An extension for a made-up notation: `@@word@@` becomes an underline element.
	const atNotation: SyntaxExtension = {
		name: "at",
		remarkPlugins: [
			() => (tree: Root) => {
				visit(tree, "text", (node, index, parent) => {
					const match = /@@(\w+)@@/.exec(node.value);
					if (!match || index == null || !parent) return;
					parent.children.splice(index, 1, {
						type: "mdxJsxTextElement",
						name: "u",
						attributes: [],
						children: [{ type: "text", value: match[1] ?? "" }],
					} as never);
				});
			},
		],
	};

	it("MdxAdminProvider registers one source panel for mdx, which is MdxSourcePanel", () => {
		const { result } = renderHook(() => useCmsAdminComponents(), { wrapper: MdxAdminProvider });
		const panels = result.current.sourcePanels?.filter((panel) => panel.format === "mdx") ?? [];
		expect(panels).toHaveLength(1);
		expect(panels[0]?.Panel).toBe(MdxSourcePanel);
	});

	it("MdxAdminProvider registers the mdx format, found by name and absent without the provider", () => {
		expect(renderHook(() => useFormat("mdx")).result.current).toBeUndefined();
		const { result } = renderHook(() => useFormat("mdx"), { wrapper: MdxAdminProvider });
		expect(result.current?.name).toBe("mdx");
		expect(renderHook(() => useFormat("markdown"), { wrapper: MdxAdminProvider }).result.current).toBeUndefined();
	});

	it("the registered format reads with the syntax extensions of mdx({ syntax })", async () => {
		// The provider keeps what it registered for the page, so the syntax is set before the module is read again.
		vi.resetModules();
		mocks.syntax = [atNotation];
		try {
			const { MdxAdminProvider: Fresh } = await import("./provider");
			// The modules are read again, so the hook comes from the same copy of the admin package as the provider.
			const { useFormat: useFreshFormat } = await import("@monti-cms/admin");
			const { result } = renderHook(() => useFreshFormat("mdx"), { wrapper: Fresh });
			const read = result.current?.import("앞 @@word@@ 뒤");
			expect(read?.ok).toBe(true);
			expect(JSON.stringify(read && "doc" in read ? read.doc : null)).toContain("underline");
			// Without the extension the notation is ordinary text.
			const plain = mdxBrowserFormat.import("앞 @@word@@ 뒤");
			expect(JSON.stringify(plain.ok ? plain.doc : null)).toContain("@@word@@");
		} finally {
			mocks.syntax = [];
			vi.resetModules();
		}
	});

	it("adds its panel to the ones other providers registered", () => {
		const Other = () => null;
		const { result } = renderHook(() => useCmsAdminComponents(), {
			wrapper: ({ children }) => (
				<CmsAdminComponentsProvider components={{ sourcePanels: [{ format: "other", label: "Other", Panel: Other }] }}>
					<MdxAdminProvider>{children}</MdxAdminProvider>
				</CmsAdminComponentsProvider>
			),
		});
		const formats = result.current.sourcePanels?.map((panel) => panel.format) ?? [];
		expect(formats).toContain("other");
		expect(formats).toContain("mdx");
	});
});
