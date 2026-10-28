import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Sheet, SheetBody, SheetClose, SheetContent, SheetFooter, SheetHeader, SheetTitle } from "../sheet";
import { SidePanel } from "../side-panel";

afterEach(cleanup);

describe("SidePanel", () => {
	it("is a landmark beside the page, named by its title", () => {
		render(<SidePanel title="desk-morning.jpg">body</SidePanel>);
		const panel = screen.getByRole("complementary", { name: "desk-morning.jpg" });
		expect(panel.textContent).toContain("body");
	});

	it("has a close button only when it is given something to do", () => {
		const onClose = vi.fn();
		const { rerender } = render(<SidePanel title="T">x</SidePanel>);
		expect(screen.queryByRole("button", { name: "Close" })).toBeNull();
		rerender(
			<SidePanel title="T" onClose={onClose}>
				x
			</SidePanel>,
		);
		fireEvent.click(screen.getByRole("button", { name: "Close" }));
		expect(onClose).toHaveBeenCalledTimes(1);
	});

	it("keeps its actions in the head and its footer under the body", () => {
		render(
			<SidePanel
				title="T"
				onClose={() => undefined}
				actions={<button type="button">More</button>}
				footer={<button type="button">Save</button>}
			>
				body
			</SidePanel>,
		);
		const buttons = screen
			.getAllByRole("button")
			.map((button) => button.textContent || button.getAttribute("aria-label"));
		expect(buttons).toEqual(["More", "Close", "Save"]);
	});
});

describe("Sheet", () => {
	const sheet = (onOpenChange = vi.fn()) =>
		render(
			<Sheet open onOpenChange={onOpenChange}>
				<SheetContent>
					<SheetHeader>
						<SheetTitle of="blog-export.zip">Import</SheetTitle>
					</SheetHeader>
					<SheetBody>work</SheetBody>
					<SheetFooter>
						<SheetClose>Cancel</SheetClose>
						<button type="button">Import 21</button>
					</SheetFooter>
				</SheetContent>
			</Sheet>,
		);

	it("opens as a dialog named by its title, with the file it is about beside the title", async () => {
		sheet();
		const dialog = await screen.findByRole("dialog", { name: /^Import/ });
		expect(dialog.textContent).toContain("blog-export.zip");
	});

	it("closes from its close button, from Cancel and from Esc", async () => {
		const onOpenChange = vi.fn();
		sheet(onOpenChange);
		const dialog = await screen.findByRole("dialog");
		fireEvent.click(screen.getByRole("button", { name: "Close" }));
		await waitFor(() => expect(onOpenChange).toHaveBeenCalledTimes(1));
		fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
		await waitFor(() => expect(onOpenChange).toHaveBeenCalledTimes(2));
		fireEvent.keyDown(dialog, { key: "Escape" });
		await waitFor(() => expect(onOpenChange).toHaveBeenCalledTimes(3));
		for (const [open] of onOpenChange.mock.calls) expect(open).toBe(false);
	});
});
