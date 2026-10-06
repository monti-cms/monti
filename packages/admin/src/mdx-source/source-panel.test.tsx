import {
	contentPath,
	createTranslator,
	DEFAULT_LOCALE,
	LINKABLE_COLLECTIONS,
	localizePath,
} from "@monti-cms/core/client";
import { isBlockId, STORED_DOCUMENT_VERSION, type StoredDocument, unparsedDocument } from "@monti-cms/core/document";
import { cleanup, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CmsAdminComponentsProvider, useCmsAdminComponents, useFormat, useSourceFormat } from "../admin-components";
import { resetLinkTargets } from "../editor/link-targets";
import { docOf, mdxOfDoc } from "../test/mdx";
import { mdxBrowserFormat } from "./format";
import { mdxSourceMessages } from "./messages";
import { MdxSourceProvider } from "./provider";
import { lineOfBlock, MdxSourcePanel } from "./source-panel";

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
	const ID = "6f1c0b0e-3c1d-4a0e-9f5a-0d9c2f1e7a11";
	const COLLECTION = LINKABLE_COLLECTIONS[0] as string;
	const PATH = localizePath(DEFAULT_LOCALE, contentPath(COLLECTION, "details") as string);
	const linked = () => docOf(`앞 [상세 글](entry:${ID}) 뒤\n`);
	const answer = (ok: boolean) =>
		vi.fn(async () =>
			ok
				? {
						ok: true,
						status: 200,
						json: async () => ({
							id: ID,
							collection: COLLECTION,
							status: "published",
							locale: DEFAULT_LOCALE,
							workingSlug: "details",
							publishedSlug: "details",
							working: { metadata: { title: "상세" } },
						}),
					}
				: { ok: false, status: 404, json: async () => ({ code: "not_found" }) },
		);

	afterEach(() => {
		vi.unstubAllGlobals();
		resetLinkTargets();
	});

	it("are written with the entry's address once it is looked up, not as entry:<id>", async () => {
		resetLinkTargets();
		vi.stubGlobal("fetch", answer(true));
		render(<MdxSourcePanel doc={linked()} onChange={() => {}} />);
		await waitFor(() => expect(textarea().value).toContain(`[상세 글](${PATH})`));
		expect(textarea().value).not.toContain("entry:");
	});

	it("keep entry:<id> when the entry cannot be resolved", async () => {
		resetLinkTargets();
		const fetchMock = answer(false);
		vi.stubGlobal("fetch", fetchMock);
		render(<MdxSourcePanel doc={linked()} onChange={() => {}} />);
		await waitFor(() => expect(fetchMock).toHaveBeenCalled());
		expect(textarea().value).toContain(`(entry:${ID})`);
	});

	it("an address typed for the entry already linked stays that link; any other typed path stays an href for the server", async () => {
		resetLinkTargets();
		vi.stubGlobal("fetch", answer(true));
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
	it("MdxSourceProvider registers the mdx format and one source panel for it", () => {
		const { result } = renderHook(() => useCmsAdminComponents(), { wrapper: MdxSourceProvider });
		expect(result.current.sourcePanels?.map((panel) => panel.format)).toEqual(["mdx"]);
		expect(result.current.sourcePanels?.[0]?.Panel).toBe(MdxSourcePanel);
		expect(result.current.formats?.mdx).toBe(mdxBrowserFormat);
	});

	it("useFormat finds a format by name, and has none when nothing registered it", () => {
		expect(renderHook(() => useFormat("mdx")).result.current).toBeUndefined();
		expect(renderHook(() => useFormat("mdx"), { wrapper: MdxSourceProvider }).result.current).toBe(mdxBrowserFormat);
		expect(renderHook(() => useFormat("markdown"), { wrapper: MdxSourceProvider }).result.current).toBeUndefined();
	});

	it("useSourceFormat is the format of the registered panel, and nothing without one", () => {
		expect(renderHook(() => useSourceFormat()).result.current).toBeUndefined();
		expect(renderHook(() => useSourceFormat(), { wrapper: MdxSourceProvider }).result.current).toBe(mdxBrowserFormat);
	});

	it("panels and formats add up across providers, outer ones first", () => {
		const Other = () => null;
		const markdown = {
			name: "markdown",
			label: "Markdown",
			export: () => "",
			import: () => ({
				ok: true as const,
				doc: { type: "doc" as const, version: STORED_DOCUMENT_VERSION, content: [] },
				warnings: [],
			}),
		};
		const { result } = renderHook(() => useCmsAdminComponents(), {
			wrapper: ({ children }) => (
				<CmsAdminComponentsProvider
					components={{
						sourcePanels: [{ format: "markdown", label: "Markdown", Panel: Other }],
						formats: { markdown },
					}}
				>
					<MdxSourceProvider>{children}</MdxSourceProvider>
				</CmsAdminComponentsProvider>
			),
		});
		expect(result.current.sourcePanels?.map((panel) => panel.format)).toEqual(["markdown", "mdx"]);
		expect(Object.keys(result.current.formats ?? {}).sort()).toEqual(["markdown", "mdx"]);
	});
});
