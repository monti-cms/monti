import { SiteProvider } from "@monti-cms/core/site";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { testConfig, testSite } from "../../../../core/test/site";
import { preferenceKey } from "../../lib/utils/site-storage";
import { docOf } from "../../test/mdx";
import { renderWithSite } from "../../test/site";
import { DEFAULT_EDITOR_WIDTH, FULL_EDITOR_WIDTH, resolveEditorWidths } from "../editor-width";
import { editorMessages } from "../messages";
import { CmsEditor } from "../tiptap-editor";

const t = testSite.createTranslator(editorMessages);
const widths = [
	{ label: "데스크톱", width: "720px" },
	{ label: "모바일", width: "375px" },
];

beforeAll(() => {
	const empty = () =>
		({ length: 0, item: () => null, [Symbol.iterator]: [][Symbol.iterator] }) as unknown as DOMRectList;
	const rect = () => new DOMRect(0, 0, 0, 0);
	for (const proto of [Range.prototype, Text.prototype] as unknown as Record<string, unknown>[]) {
		proto.getClientRects ??= empty;
		proto.getBoundingClientRect ??= rect;
	}
});
afterEach(() => {
	cleanup();
	window.localStorage.removeItem(preferenceKey(testSite, "editor-width"));
});

const editor = <CmsEditor doc={docOf("안녕하세요")} onChange={() => {}} titleField={<input aria-label="제목" />} />;
const renderEditor = async (editorConfig?: { widths: typeof widths }) => {
	if (editorConfig)
		render(
			<SiteProvider config={{ ...testConfig, editor: editorConfig }}>
				<QueryClientProvider client={new QueryClient()}>{editor}</QueryClientProvider>
			</SiteProvider>,
		);
	else renderWithSite(editor);
	await screen.findByRole("button", { name: t("editorWidth.label") });
};
/** Body width applied to the editor frame. The title, body and source all use this value. */
const editorWidth = () =>
	(document.querySelector("[data-monti-editor-shell]") as HTMLElement).style.getPropertyValue("--editor-width");
const openMenu = async () => {
	fireEvent.click(screen.getByRole("button", { name: t("editorWidth.label") }));
	return screen.findAllByRole("menuitemradio");
};

describe("resolveEditorWidths", () => {
	it("is the normal step and full when the config sets no widths", () => {
		const steps = resolveEditorWidths(undefined, t);
		expect(steps.map((step) => step.label)).toEqual([t("editorWidth.normal"), t("editorWidth.full")]);
		expect(steps[0]?.width).toBe(DEFAULT_EDITOR_WIDTH);
	});

	it("lists the configured steps in order and appends full last", () => {
		const steps = resolveEditorWidths(widths, t);
		expect(steps.map((step) => step.label)).toEqual([...widths.map((step) => step.label), t("editorWidth.full")]);
		expect(steps.slice(0, -1).map((step) => step.width)).toEqual(widths.map((step) => step.width));
		expect(steps.at(-1)?.width).toBe(FULL_EDITOR_WIDTH);
	});

	it("does not mix a configured label with a built-in step", () => {
		const steps = resolveEditorWidths([{ label: "full", width: "10rem" }], t);
		expect(new Set(steps.map((step) => step.key)).size).toBe(steps.length);
	});
});

describe(t("editorWidth.label"), () => {
	it("starts at the normal width without configured steps, and offers normal and full only", async () => {
		await renderEditor();
		expect(editorWidth()).toBe(DEFAULT_EDITOR_WIDTH);
		expect(await openMenu()).toHaveLength(2);
	});

	it("starts at the first configured step and lists the steps in config order, full last", async () => {
		await renderEditor({ widths });
		expect(editorWidth()).toBe(widths[0]?.width);
		const items = await openMenu();
		expect(items.map((item) => item.textContent)).toEqual([...widths.map((step) => step.label), t("editorWidth.full")]);
	});

	it("applies a picked step and remembers it after reopening", async () => {
		await renderEditor({ widths });
		await openMenu();
		fireEvent.click(screen.getByRole("menuitemradio", { name: widths[1]?.label }));
		await waitFor(() => expect(editorWidth()).toBe(widths[1]?.width));

		cleanup();
		await renderEditor({ widths });
		await waitFor(() => expect(editorWidth()).toBe(widths[1]?.width));
	});

	it("remembers full too", async () => {
		await renderEditor({ widths });
		await openMenu();
		fireEvent.click(screen.getByRole("menuitemradio", { name: t("editorWidth.full") }));
		await waitFor(() => expect(editorWidth()).toBe(FULL_EDITOR_WIDTH));

		cleanup();
		await renderEditor({ widths });
		await waitFor(() => expect(editorWidth()).toBe(FULL_EDITOR_WIDTH));
	});

	it("falls back to the first step when the remembered step is no longer in the config", async () => {
		await renderEditor({ widths });
		await openMenu();
		fireEvent.click(screen.getByRole("menuitemradio", { name: widths[1]?.label }));
		await waitFor(() => expect(editorWidth()).toBe(widths[1]?.width));

		cleanup();
		await renderEditor({ widths: [{ label: "태블릿", width: "768px" }] });
		expect(editorWidth()).toBe("768px");
	});
});
