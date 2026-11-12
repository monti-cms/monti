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

	it("with lockWhileBusy, Cancel is off while the request runs", async () => {
		const cancelled = vi.fn();
		const footer = (busy: boolean) => (
			<Dialog defaultOpen>
				<DialogContent form>
					<Stack as="form" gap={16}>
						<DialogHeader>
							<DialogTitle>Add key</DialogTitle>
						</DialogHeader>
						<DialogFormFooter onCancel={cancelled} submitLabel="Add" busy={busy} busyLabel="Checking…" lockWhileBusy />
					</Stack>
				</DialogContent>
			</Dialog>
		);
		render(footer(true));
		await expect.element(page.getByRole("button", { name: "Cancel" })).toBeDisabled();
		await expect.element(page.getByRole("button", { name: "Checking…" })).toBeVisible();
	});

	it("without it, Cancel can be pressed while the request runs", async () => {
		const cancelled = vi.fn();
		render(
			<Dialog defaultOpen>
				<DialogContent form>
					<Stack as="form" gap={16}>
						<DialogHeader>
							<DialogTitle>Export</DialogTitle>
						</DialogHeader>
						<DialogFormFooter onCancel={cancelled} submitLabel="Export" busy />
					</Stack>
				</DialogContent>
			</Dialog>,
		);
		await userEvent.click(page.getByRole("button", { name: "Cancel" }));
		expect(cancelled).toHaveBeenCalledTimes(1);
	});
});
