import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Editor } from "@tiptap/core";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CustomBlockMenu } from "../custom-block-menu";
import { buildEditorExtensions } from "../extensions";

vi.mock("../../ui/tooltip", () => ({
	Tooltip: ({ children }: { children: React.ReactNode }) => children,
	TooltipTrigger: ({
		render,
		children,
	}: {
		render?: React.ReactElement<{ children?: React.ReactNode }>;
		children?: React.ReactNode;
	}) => (render ? React.cloneElement(render, {}, children ?? render.props.children) : children),
	TooltipContent: () => null,
	TooltipProvider: ({ children }: { children: React.ReactNode }) => children,
}));

afterEach(cleanup);

const createEditor = (editable = true) =>
	new Editor({ extensions: buildEditorExtensions(), content: "<p>안녕하세요</p>", editable });

describe("CustomBlockMenu", () => {
	it("메뉴를 열면 커스텀 컴포넌트 목록이 보인다", async () => {
		const editor = createEditor();
		render(<CustomBlockMenu editor={editor} />);

		fireEvent.click(screen.getByRole("button", { name: "컴포넌트 넣기" }));

		expect(await screen.findByRole("menuitem", { name: /^콜아웃/ })).toBeTruthy();
		expect(screen.getByRole("menuitem", { name: /^접기/ })).toBeTruthy();
		editor.destroy();
	});

	it("콜아웃을 고르면 문서에 cmsCallout 노드가 들어간다", async () => {
		const editor = createEditor();
		editor.commands.setTextSelection(3);
		render(<CustomBlockMenu editor={editor} />);

		fireEvent.click(screen.getByRole("button", { name: "컴포넌트 넣기" }));
		fireEvent.click(await screen.findByRole("menuitem", { name: /^콜아웃/ }));

		const types: string[] = [];
		editor.state.doc.descendants((node) => {
			types.push(node.type.name);
		});
		expect(types).toContain("cmsCallout");
		// 빈 범위라 기존 글자는 지워지지 않고 커서 자리에서 갈라질 뿐이다.
		expect(editor.getText()).toContain("안녕");
		expect(editor.getText()).toContain("하세요");
		editor.destroy();
	});

	it("편집할 수 없으면 버튼이 비활성화된다", () => {
		const editor = createEditor(false);
		render(<CustomBlockMenu editor={editor} />);

		const button = screen.getByRole("button", { name: "컴포넌트 넣기" }) as HTMLButtonElement;
		expect(button.disabled).toBe(true);
		editor.destroy();
	});
});
