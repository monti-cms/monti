import { buildEditorExtensions } from "@monti-cms/admin/editor";
import { TooltipProvider } from "@monti-cms/admin/kit";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Editor } from "@tiptap/core";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OPEN_TOOLTIP_EVENT, tooltipMarkExtension } from "../provider";

// 관리자 편집기 안의 툴팁 부품 파일을 바꾼다(확장용 묶음 `kit`과 본체 서식 도구가 같은 파일을 쓴다).
vi.mock("../../../../admin/src/ui/tooltip", () => ({
	Tooltip: ({ children }: { children: React.ReactNode }) => children,
	TooltipTrigger: ({
		render,
		children,
	}: {
		render?: React.ReactElement<{ children?: React.ReactNode }>;
		children?: React.ReactNode;
	}) => {
		if (render) {
			return React.cloneElement(render, {}, children ?? render.props.children);
		}
		return <>{children}</>;
	},
	TooltipContent: () => null,
	TooltipProvider: ({ children }: { children: React.ReactNode }) => children,
}));

afterEach(cleanup);

/** 툴팁 확장의 서식 도구 버튼(본체 `MarkTextPopover`). */
const TooltipButton = tooltipMarkExtension.toolbar?.Button ?? (() => null);

describe("툴팁 확장의 서식 도구 팝오버 (v2 C3a)", () => {
	const createEditor = (html = "<p>안녕하세요 세상입니다</p>") =>
		new Editor({
			extensions: buildEditorExtensions({ tooltip: tooltipMarkExtension }),
			content: html,
		});

	const renderComponent = (editor: Editor) =>
		render(
			<TooltipProvider delay={0}>
				<TooltipButton editor={editor} />
			</TooltipProvider>,
		);

	it("선택 영역이 비어 있고 툴팁 안이 아니면 버튼이 비활성화된다", () => {
		const editor = createEditor();
		editor.chain().focus().setTextSelection(1).run();

		renderComponent(editor);

		const button = screen.getByRole("button", { name: "툴팁" }) as HTMLButtonElement;
		expect(button.disabled).toBe(true);
		editor.destroy();
	});

	it("텍스트가 선택되어 있으면 버튼이 활성화된다", () => {
		const editor = createEditor();
		editor.chain().focus().setTextSelection({ from: 1, to: 5 }).run();

		renderComponent(editor);

		const button = screen.getByRole("button", { name: "툴팁" }) as HTMLButtonElement;
		expect(button.disabled).toBe(false);
		editor.destroy();
	});

	it("커서가 툴팁 마크 안이면 버튼이 눌린 상태(aria-pressed=true)이고 비활성화되지 않는다", () => {
		const editor = createEditor();
		editor.chain().focus().setTextSelection({ from: 7, to: 9 }).setMark("cmsTooltip", { content: "설명" }).run();

		editor.chain().focus().setTextSelection(8).run();

		renderComponent(editor);

		const button = screen.getByRole("button", { name: "툴팁" }) as HTMLButtonElement;
		expect(button.disabled).toBe(false);
		expect(button.getAttribute("aria-pressed")).toBe("true");
		editor.destroy();
	});

	it("툴팁 안에서 팝오버를 열면 기존 설명이 표시되고, 해제 버튼이 나타난다", () => {
		const editor = createEditor();
		editor
			.chain()
			.focus()
			.setTextSelection({ from: 7, to: 9 })
			.setMark("cmsTooltip", { content: "기존 툴팁 설명" })
			.run();

		editor.chain().focus().setTextSelection(8).run();

		renderComponent(editor);

		const trigger = screen.getByRole("button", { name: "툴팁" });
		act(() => {
			fireEvent.click(trigger);
		});

		const input = screen.getByLabelText("설명") as HTMLTextAreaElement;
		expect(input.value).toBe("기존 툴팁 설명");

		const removeBtn = screen.getByRole("button", { name: "툴팁 해제" });
		expect(removeBtn).toBeTruthy();

		act(() => {
			fireEvent.click(removeBtn);
		});
		expect(editor.isActive("cmsTooltip")).toBe(false);
		editor.destroy();
	});

	it("인접한 서로 다른 설명의 툴팁은 현재 마크만 해제한다", () => {
		const editor = createEditor("<p>가나다라</p>");
		editor.chain().focus().setTextSelection({ from: 1, to: 3 }).setMark("cmsTooltip", { content: "첫째" }).run();
		editor.chain().focus().setTextSelection({ from: 3, to: 5 }).setMark("cmsTooltip", { content: "둘째" }).run();
		editor.chain().focus().setTextSelection(2).run();
		renderComponent(editor);
		act(() => fireEvent.click(screen.getByRole("button", { name: "툴팁" })));
		act(() => fireEvent.click(screen.getByRole("button", { name: "툴팁 해제" })));
		expect(editor.getJSON().content?.[0]?.content?.[0]?.marks).toBeUndefined();
		expect(editor.getJSON().content?.[0]?.content?.[1]?.marks?.[0]?.attrs?.content).toBe("둘째");
		editor.destroy();
	});

	it("IME 한글 조합 중 Enter 입력 시 적용되지 않고, 조합 완료 후 Enter로 적용된다", () => {
		const editor = createEditor();
		editor.chain().focus().setTextSelection({ from: 7, to: 9 }).run();

		renderComponent(editor);

		const trigger = screen.getByRole("button", { name: "툴팁" });
		act(() => {
			fireEvent.click(trigger);
		});

		const input = screen.getByLabelText("설명") as HTMLTextAreaElement;
		act(() => {
			fireEvent.change(input, { target: { value: "새로운 설명" } });
		});

		// 1) IME 조합 중 Enter 발생: 무시되어야 함
		act(() => {
			fireEvent.keyDown(input, {
				key: "Enter",
				isComposing: true,
			});
		});
		expect(editor.isActive("cmsTooltip")).toBe(false);

		// 2) 조합 완료 후 정상 Enter: 적용되어야 함
		act(() => {
			fireEvent.keyDown(input, {
				key: "Enter",
				isComposing: false,
			});
		});
		expect(editor.isActive("cmsTooltip")).toBe(true);
		expect(editor.getAttributes("cmsTooltip").content).toBe("새로운 설명");
		editor.destroy();
	});

	it("적용 버튼 클릭 시 설명을 마크에 적용한다", () => {
		const editor = createEditor();
		editor.chain().focus().setTextSelection({ from: 1, to: 5 }).run();

		renderComponent(editor);

		const trigger = screen.getByRole("button", { name: "툴팁" });
		act(() => {
			fireEvent.click(trigger);
		});

		const input = screen.getByLabelText("설명") as HTMLTextAreaElement;
		act(() => {
			fireEvent.change(input, { target: { value: "인사말" } });
		});

		const applyBtn = screen.getByRole("button", { name: "적용" });
		act(() => {
			fireEvent.click(applyBtn);
		});

		expect(editor.isActive("cmsTooltip")).toBe(true);
		expect(editor.getAttributes("cmsTooltip").content).toBe("인사말");
		editor.destroy();
	});

	it("설명이 비어 있으면 적용하지 않고 폼 안에 오류를 보인다", () => {
		const editor = createEditor();
		editor.chain().focus().setTextSelection({ from: 1, to: 5 }).run();
		renderComponent(editor);
		act(() => fireEvent.click(screen.getByRole("button", { name: "툴팁" })));
		act(() => fireEvent.click(screen.getByRole("button", { name: "적용" })));
		expect(screen.getByRole("alert").textContent).toBe("설명을 입력하세요.");
		expect(editor.isActive("cmsTooltip")).toBe(false);
		editor.destroy();
	});

	it("cms:open-tooltip 커스텀 이벤트를 받으면 팝오버를 연다", () => {
		const editor = createEditor();
		editor.chain().focus().setTextSelection({ from: 1, to: 5 }).run();

		renderComponent(editor);

		act(() => {
			window.dispatchEvent(new CustomEvent(OPEN_TOOLTIP_EVENT));
		});

		expect(screen.getByLabelText("설명")).toBeTruthy();
		editor.destroy();
	});
});
