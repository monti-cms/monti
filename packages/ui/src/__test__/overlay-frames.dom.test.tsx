import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Sheet, SheetBody, SheetClose, SheetContent, SheetFooter, SheetHeader, SheetTitle } from "../sheet";
import { SidePanel } from "../side-panel";

afterEach(cleanup);

describe("SidePanel", () => {
	it("UI-A3 is a landmark beside the page, named by its title", () => {
		render(<SidePanel title="desk-morning.jpg">body</SidePanel>);
		const panel = screen.getByRole("complementary", { name: "desk-morning.jpg" });
		expect(panel.textContent).toContain("body");
	});

	it("UI-A2 has a close button only when it is given something to do", () => {
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

	it("UI-A3 opens as a dialog named by its title, with the file it is about beside the title", async () => {
		sheet();
		const dialog = await screen.findByRole("dialog", { name: /^Import/ });
		expect(dialog.textContent).toContain("blog-export.zip");
	});

	it("UI-K6 closes from its close button, from Cancel and from Esc", async () => {
		const onOpenChange = vi.fn();
		sheet(onOpenChange);
		const dialog = await screen.findByRole("dialog");
		fireEvent.click(screen.getByRole("button", { name: "Close" }));
		await waitFor(() => expect(onOpenChange).toHaveBeenNthCalledWith(1, false, expect.anything()));
		fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
		await waitFor(() => expect(onOpenChange).toHaveBeenNthCalledWith(2, false, expect.anything()));
		fireEvent.keyDown(dialog, { key: "Escape" });
		await waitFor(() => expect(onOpenChange).toHaveBeenNthCalledWith(3, false, expect.anything()));
	});
});
