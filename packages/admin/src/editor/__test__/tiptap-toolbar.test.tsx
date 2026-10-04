import { createTranslator } from "@monti-cms/core/client";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { Editor } from "@tiptap/core";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { editorMessages } from "../messages";
import { CmsEditor } from "../tiptap-editor";

const t = createTranslator(editorMessages);

// jsdom에는 글자 범위의 좌표가 없다. 서식을 적용한 뒤 ProseMirror가 커서 위치를 잴 때 쓴다.
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
	vi.restoreAllMocks();
});

const renderEditor = async () => {
	const onChange = vi.fn();
	render(<CmsEditor content="안녕하세요" onChange={onChange} />);
	await screen.findByRole("toolbar", { name: t("toolbar.format") });
	return onChange;
};
const toolbarButtonNames = (toolbar: HTMLElement) =>
	within(toolbar)
		.getAllByRole("button")
		.map((button) => button.getAttribute("aria-label") || button.textContent);
const savedText = (onChange: ReturnType<typeof vi.fn>) => String(onChange.mock.lastCall?.[0] ?? "");

describe("서식 도구 묶음", () => {
	it("정렬·첨자는 아이콘 하나짜리 드롭다운이고 개별 버튼은 없다", async () => {
		await renderEditor();
		const toolbar = screen.getByRole("toolbar", { name: t("toolbar.format") });

		expect(within(toolbar).getByRole("button", { name: t("toolbar.align") })).toBeTruthy();
		expect(within(toolbar).getByRole("button", { name: t("toolbar.script") })).toBeTruthy();
		expect(within(toolbar).queryByRole("button", { name: t("toolbar.alignLeftTitle") })).toBeNull();
		expect(within(toolbar).queryByRole("button", { name: t("inlineMarks.superscript") })).toBeNull();
		// 폭을 잴 수 없으면(jsdom) 전부 보이고 더보기는 그리지 않는다.
		expect(within(toolbar).queryByRole("button", { name: t("toolbarRow.more") })).toBeNull();
	});

	it("링크 버튼은 커서가 링크 안에 있으면 눌린 상태다", async () => {
		let editor: Editor | null = null;
		render(
			<CmsEditor
				content="[주소](https://example.com) 뒤"
				onChange={vi.fn()}
				onEditor={(ready) => {
					editor = ready;
				}}
			/>,
		);
		const toolbar = await screen.findByRole("toolbar", { name: t("toolbar.format") });
		await waitFor(() => expect(editor).not.toBeNull());
		expect(
			within(toolbar)
				.getByRole("button", { name: t("toolbar.link") })
				.getAttribute("aria-pressed"),
		).toBe("false");
		act(() => {
			(editor as unknown as Editor).commands.setTextSelection(2);
		});
		await waitFor(() =>
			expect(
				within(toolbar)
					.getByRole("button", { name: t("toolbar.link") })
					.getAttribute("aria-pressed"),
			).toBe("true"),
		);
	});

	it("정렬 메뉴에서 가운데를 고르면 문단이 가운데 정렬된다", async () => {
		const onChange = await renderEditor();

		fireEvent.click(screen.getByRole("button", { name: t("toolbar.align") }));
		fireEvent.click(await screen.findByRole("menuitem", { name: t("toolbar.alignCenterTitle") }));

		await waitFor(() => expect(savedText(onChange)).toContain("center"));
	});

	it("첨자 메뉴에 위첨자·아래첨자가 있다", async () => {
		await renderEditor();

		fireEvent.click(screen.getByRole("button", { name: t("toolbar.script") }));

		expect(await screen.findByRole("menuitem", { name: t("inlineMarks.superscript") })).toBeTruthy();
		expect(screen.getByRole("menuitem", { name: t("inlineMarks.subscript") })).toBeTruthy();
	});

	it("폭이 좁으면 덜 쓰는 도구부터 더보기로 접고 메뉴에서 그대로 쓴다", async () => {
		vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(300);
		vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
			width: 32,
			height: 32,
			x: 0,
			y: 0,
			top: 0,
			left: 0,
			right: 32,
			bottom: 32,
			toJSON: () => ({}),
		});
		const onChange = await renderEditor();
		const toolbar = screen.getByRole("toolbar", { name: t("toolbar.format") });

		const more = await within(toolbar).findByRole("button", { name: t("toolbarRow.more") });
		// 고정 도구는 남고, 우선순위가 가장 낮은 정렬은 접힌다.
		expect(within(toolbar).getByRole("button", { name: t("inlineMarks.bold") })).toBeTruthy();
		expect(within(toolbar).getByRole("button", { name: t("toolbar.link") })).toBeTruthy();
		expect(within(toolbar).queryByRole("button", { name: t("toolbar.align") })).toBeNull();

		fireEvent.click(more);
		fireEvent.click(await screen.findByRole("menuitem", { name: t("toolbar.alignCenterTitle") }));
		await waitFor(() => expect(savedText(onChange)).toContain("center"));
	});

	it("도구 이름과 순서가 정해져 있다", async () => {
		await renderEditor();
		const toolbar = screen.getByRole("toolbar", { name: t("toolbar.format") });

		// 문단 모양 → 글자 꾸밈 → 글자에 붙이기(링크) → 목록·정렬 → 블록 넣기 순이다. 글자색·툴팁은 블록 확장이 더한다
		// (`@monti-cms/blocks`의 서식 도구 테스트).
		expect(toolbarButtonNames(toolbar)).toEqual([
			t("toolbar.paragraph"),
			t("inlineMarks.bold"),
			t("inlineMarks.italic"),
			t("inlineMarks.underline"),
			t("inlineMarks.strike"),
			t("inlineMarks.code"),
			t("toolbar.script"),
			t("toolbar.link"),
			t("toolbar.list"),
			t("toolbar.align"),
			t("toolbar.quote"),
			t("toolbar.codeBlock"),
			t("toolbar.table"),
			t("toolbar.divider"),
			t("toolbar.upload"),
			t("customBlockMenu.label"),
			t("editorWidth.label"),
		]);
	});

	it("블록 모양 메뉴는 문단·제목 2~4이다", async () => {
		await renderEditor();

		fireEvent.click(screen.getByRole("button", { name: t("toolbar.paragraph") }));

		expect((await screen.findAllByRole("menuitem")).map((item) => item.textContent)).toEqual([
			t("toolbar.paragraph"),
			t("toolbar.heading", { level: 2 }),
			t("toolbar.heading", { level: 3 }),
			t("toolbar.heading", { level: 4 }),
		]);
	});

	it("목록 메뉴는 글머리·번호·체크 목록이다", async () => {
		await renderEditor();

		fireEvent.click(screen.getByRole("button", { name: t("toolbar.list") }));

		expect((await screen.findAllByRole("menuitem")).map((item) => item.textContent)).toEqual([
			t("toolbar.bullet"),
			t("toolbar.ordered"),
			t("toolbar.todo"),
		]);
	});

	it.each([
		// 블록 확장의 글자색·툴팁이 없을 때다(있을 때는 `@monti-cms/blocks`의 서식 도구 테스트).
		[
			400,
			[
				t("toolbar.paragraph"),
				t("inlineMarks.bold"),
				t("inlineMarks.italic"),
				t("toolbar.link"),
				t("toolbar.list"),
				t("toolbar.codeBlock"),
				t("toolbarRow.more"),
				t("editorWidth.label"),
			],
		],
		[
			500,
			[
				t("toolbar.paragraph"),
				t("inlineMarks.bold"),
				t("inlineMarks.italic"),
				t("inlineMarks.code"),
				t("toolbar.link"),
				t("toolbar.list"),
				t("toolbar.codeBlock"),
				t("toolbar.upload"),
				t("customBlockMenu.label"),
				t("toolbarRow.more"),
				t("editorWidth.label"),
			],
		],
	])("폭 %ipx에서는 정해진 우선순위대로 도구를 남긴다", async (width, visible) => {
		vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(width);
		vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
			width: 32,
			height: 32,
			x: 0,
			y: 0,
			top: 0,
			left: 0,
			right: 32,
			bottom: 32,
			toJSON: () => ({}),
		});
		await renderEditor();
		const toolbar = screen.getByRole("toolbar", { name: t("toolbar.format") });

		await within(toolbar).findByRole("button", { name: t("toolbarRow.more") });
		expect(toolbarButtonNames(toolbar)).toEqual(visible);
	});
});
