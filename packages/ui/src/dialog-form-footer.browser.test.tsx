import { describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { render } from "../test/render";
import { Dialog, DialogContent, DialogFormFooter, DialogHeader, DialogTitle, Input, Stack } from "./index";

describe("DialogFormFooter", () => {
	it("Enter in a field of the form sends it with the pill, and does not cancel it", async () => {
		const sent = vi.fn();
		const cancelled = vi.fn();
		render(
			<Dialog defaultOpen>
				<DialogContent form>
					<Stack
						as="form"
						gap={16}
						onSubmit={(event) => {
							event.preventDefault();
							sent();
						}}
					>
						<DialogHeader>
							<DialogTitle>Export</DialogTitle>
						</DialogHeader>
						<Input aria-label="File name" defaultValue="posts" />
						<DialogFormFooter onCancel={cancelled} submitLabel="Export" />
					</Stack>
				</DialogContent>
			</Dialog>,
		);
		await userEvent.click(page.getByRole("textbox", { name: "File name" }));
		await userEvent.keyboard("{Enter}");
		expect(sent).toHaveBeenCalledTimes(1);
		expect(cancelled).not.toHaveBeenCalled();
		await userEvent.click(page.getByRole("button", { name: "Cancel" }));
		expect(cancelled).toHaveBeenCalledTimes(1);
		expect(sent).toHaveBeenCalledTimes(1);
	});
});
