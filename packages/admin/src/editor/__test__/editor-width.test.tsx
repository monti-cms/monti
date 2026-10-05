import { createTranslator } from "@monti-cms/core/client";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { EDITOR_WIDTHS } from "../editor-width";
import { editorMessages } from "../messages";
import { CmsEditor } from "../tiptap-editor";

const t = createTranslator(editorMessages);

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
	window.localStorage.removeItem("cms:editor-width");
});

const renderEditor = async () => {
	render(<CmsEditor content="안녕하세요" onChange={() => {}} titleField={<input aria-label="제목" />} />);
	await screen.findByRole("toolbar", { name: t("toolbar.format") });
};
/** Body width applied to the editor frame. The title, body and source all use this value. */
const editorWidth = () =>
	(document.querySelector("[data-cms-editor-shell]") as HTMLElement).style.getPropertyValue("--editor-width");

describe(t("editorWidth.label"), () => {
	it("starts at the normal width", async () => {
		await renderEditor();
		expect(editorWidth()).toBe(EDITOR_WIDTHS.normal);
	});

	it("changes when picked from the width menu and is remembered after reopening", async () => {
		await renderEditor();
		fireEvent.click(screen.getByRole("button", { name: t("editorWidth.label") }));
		expect(await screen.findAllByRole("menuitemradio")).toHaveLength(Object.keys(EDITOR_WIDTHS).length);
		fireEvent.click(screen.getByRole("menuitemradio", { name: t("editorWidth.wide") }));
		await waitFor(() => expect(editorWidth()).toBe(EDITOR_WIDTHS.wide));

		cleanup();
		await renderEditor();
		await waitFor(() => expect(editorWidth()).toBe(EDITOR_WIDTHS.wide));
	});
});
