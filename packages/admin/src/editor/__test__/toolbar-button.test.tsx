import { TooltipProvider } from "@monti-cms/ui";
import { cleanup, render, screen } from "@testing-library/react";
import type { Editor } from "@tiptap/core";
import { Trash2 } from "lucide-react";
import { afterEach, describe, expect, it } from "vitest";
import { ToolbarButton, type ToolbarItem } from "../toolbar-button";

afterEach(cleanup);

const editor = { isEditable: true } as unknown as Editor;
const renderTool = (item: Partial<ToolbarItem>) =>
	render(
		<TooltipProvider>
			<ToolbarButton editor={editor} item={{ label: "Delete row", icon: Trash2, run: () => {}, ...item }} />
		</TooltipProvider>,
	);

describe("ToolbarButton", () => {
	// The table tools that delete a row or a column carry `tone: "danger"`; the button must show it.
	it("is red when its tool removes something", () => {
		renderTool({ tone: "danger" });
		expect(screen.getByRole("button", { name: "Delete row" }).getAttribute("data-tone")).toBe("danger");
	});

	it("stays gray for any other tool", () => {
		renderTool({});
		expect(screen.getByRole("button", { name: "Delete row" }).hasAttribute("data-tone")).toBe(false);
	});
});
