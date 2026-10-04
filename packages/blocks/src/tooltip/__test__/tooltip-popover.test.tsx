import { buildEditorExtensions } from "@monti-cms/admin/editor";
import { TooltipProvider } from "@monti-cms/admin/kit";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Editor } from "@tiptap/core";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OPEN_TOOLTIP_EVENT, tooltipMarkExtension } from "../provider";

// Replaces the tooltip part file inside the admin editor (the extension's `kit` bundle and the core format tool use the same file).
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

/** Format tool button of the tooltip extension (core `MarkTextPopover`). */
const TooltipButton = tooltipMarkExtension.toolbar?.Button ?? (() => null);

describe("tooltip extension format tool popover", () => {
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

	it("disables the button when the selection is empty and not inside a tooltip", () => {
		const editor = createEditor();
		editor.chain().focus().setTextSelection(1).run();

		renderComponent(editor);

		const button = screen.getByRole("button", { name: "툴팁" }) as HTMLButtonElement;
		expect(button.disabled).toBe(true);
		editor.destroy();
	});

	it("enables the button when text is selected", () => {
		const editor = createEditor();
		editor.chain().focus().setTextSelection({ from: 1, to: 5 }).run();

		renderComponent(editor);

		const button = screen.getByRole("button", { name: "툴팁" }) as HTMLButtonElement;
		expect(button.disabled).toBe(false);
		editor.destroy();
	});

	it("shows the button as pressed (aria-pressed=true) and enabled when the cursor is inside a tooltip mark", () => {
		const editor = createEditor();
		editor.chain().focus().setTextSelection({ from: 7, to: 9 }).setMark("cmsTooltip", { content: "설명" }).run();

		editor.chain().focus().setTextSelection(8).run();

		renderComponent(editor);

		const button = screen.getByRole("button", { name: "툴팁" }) as HTMLButtonElement;
		expect(button.disabled).toBe(false);
		expect(button.getAttribute("aria-pressed")).toBe("true");
		editor.destroy();
	});

	it("shows the existing description and a remove button when the popover is opened inside a tooltip", () => {
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

	it("removes only the current mark among adjacent tooltips with different descriptions", () => {
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

	it("does not apply on Enter during Korean IME composition, and applies on Enter after composition ends", () => {
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

		// 1) Enter during IME composition: must be ignored
		act(() => {
			fireEvent.keyDown(input, {
				key: "Enter",
				isComposing: true,
			});
		});
		expect(editor.isActive("cmsTooltip")).toBe(false);

		// 2) Normal Enter after composition ends: must apply
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

	it("applies the description to the mark when the apply button is clicked", () => {
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

	it("does not apply an empty description and shows an error inside the form", () => {
		const editor = createEditor();
		editor.chain().focus().setTextSelection({ from: 1, to: 5 }).run();
		renderComponent(editor);
		act(() => fireEvent.click(screen.getByRole("button", { name: "툴팁" })));
		act(() => fireEvent.click(screen.getByRole("button", { name: "적용" })));
		expect(screen.getByRole("alert").textContent).toBe("설명을 입력하세요.");
		expect(editor.isActive("cmsTooltip")).toBe(false);
		editor.destroy();
	});

	it("opens the popover when it receives the cms:open-tooltip custom event", () => {
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
