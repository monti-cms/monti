import { cleanup, fireEvent, screen } from "@testing-library/react";
import { Editor } from "@tiptap/core";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { testSite } from "../../../../core/test/site";
import { renderWithSite } from "../../test/site";
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
	new Editor({ extensions: buildEditorExtensions(testSite), content: "<p>안녕하세요</p>", editable });

describe("CustomBlockMenu", () => {
	it("lists the custom components when the menu is opened", async () => {
		const editor = createEditor();
		renderWithSite(<CustomBlockMenu editor={editor} />);

		fireEvent.click(screen.getByRole("button", { name: "컴포넌트 넣기" }));

		expect(await screen.findByRole("menuitem", { name: /^콜아웃/ })).toBeTruthy();
		expect(screen.getByRole("menuitem", { name: /^접기/ })).toBeTruthy();
		editor.destroy();
	});

	it("choosing a callout inserts a cmsCallout node into the document", async () => {
		const editor = createEditor();
		editor.commands.setTextSelection(3);
		renderWithSite(<CustomBlockMenu editor={editor} />);

		fireEvent.click(screen.getByRole("button", { name: "컴포넌트 넣기" }));
		fireEvent.click(await screen.findByRole("menuitem", { name: /^콜아웃/ }));

		const types: string[] = [];
		editor.state.doc.descendants((node) => {
			types.push(node.type.name);
		});
		expect(types).toContain("cmsCallout");
		// The range is empty, so existing text is not erased and is only split at the cursor.
		expect(editor.getText()).toContain("안녕");
		expect(editor.getText()).toContain("하세요");
		editor.destroy();
	});

	it("the button is disabled when not editable", () => {
		const editor = createEditor(false);
		renderWithSite(<CustomBlockMenu editor={editor} />);

		const button = screen.getByRole("button", { name: "컴포넌트 넣기" }) as HTMLButtonElement;
		expect(button.disabled).toBe(true);
		editor.destroy();
	});
});
