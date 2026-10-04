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
/** 편집기 틀에 걸린 본문 폭. 제목·본문·원문이 모두 이 값을 쓴다. */
const editorWidth = () =>
	(document.querySelector("[data-cms-editor-shell]") as HTMLElement).style.getPropertyValue("--editor-width");

describe(t("editorWidth.label"), () => {
	it("처음에는 보통 폭이다", async () => {
		await renderEditor();
		expect(editorWidth()).toBe(EDITOR_WIDTHS.normal);
	});

	it("폭 메뉴에서 고르면 바뀌고, 다시 열어도 기억한다", async () => {
		await renderEditor();
		fireEvent.click(screen.getByRole("button", { name: t("editorWidth.label") }));
		expect((await screen.findAllByRole("menuitemradio")).map((item) => item.textContent)).toEqual([
			t("editorWidth.narrow"),
			t("editorWidth.normal"),
			t("editorWidth.wide"),
			t("editorWidth.full"),
		]);
		fireEvent.click(screen.getByRole("menuitemradio", { name: t("editorWidth.wide") }));
		await waitFor(() => expect(editorWidth()).toBe(EDITOR_WIDTHS.wide));

		cleanup();
		await renderEditor();
		await waitFor(() => expect(editorWidth()).toBe(EDITOR_WIDTHS.wide));
	});

	it("좁게는 공개 블로그 본문과 같은 폭이다", () => {
		expect(EDITOR_WIDTHS.narrow).toBe("42rem");
	});
});
