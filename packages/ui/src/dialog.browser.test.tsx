import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { holdKey, keyTwice, pressTwice, releaseKey } from "../../../testing/input";
import { render } from "../test/render";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	Button,
	Dialog,
	DialogContent,
	DialogFormFooter,
	DialogHeader,
	DialogTitle,
	Input,
	Sheet,
	SheetBody,
	SheetContent,
	SheetFooter,
	SheetHeader,
	SheetTitle,
	Stack,
} from "./index";

/** A question whose button does the thing and closes it, as the screens write theirs. */
function Question({ onConfirm }: { onConfirm: () => void }) {
	const [open, setOpen] = useState(true);
	return (
		<AlertDialog open={open} onOpenChange={setOpen}>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>Delete the key?</AlertDialogTitle>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel>Cancel</AlertDialogCancel>
					<AlertDialogAction
						variant="danger"
						onClick={() => {
							setOpen(false);
							onConfirm();
						}}
					>
						Delete
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}

/** A form window opened by a button: sending the form does the thing and closes the window. */
function FormWindow({ onSend, onOpen }: { onSend: () => void; onOpen?: () => void }) {
	const [open, setOpen] = useState(false);
	return (
		<>
			<Button
				onClick={() => {
					setOpen(true);
					onOpen?.();
				}}
			>
				Rename
			</Button>
			<Dialog open={open} onOpenChange={setOpen}>
				<DialogContent form>
					<Stack
						as="form"
						gap={16}
						onSubmit={(event) => {
							event.preventDefault();
							setOpen(false);
							onSend();
						}}
					>
						<DialogHeader>
							<DialogTitle>Rename</DialogTitle>
						</DialogHeader>
						<Input aria-label="Name" defaultValue="posts" />
						<DialogFormFooter onCancel={() => setOpen(false)} />
					</Stack>
				</DialogContent>
			</Dialog>
		</>
	);
}

function Drawer({ onConfirm }: { onConfirm: () => void }) {
	const [open, setOpen] = useState(true);
	return (
		<Sheet open={open} onOpenChange={setOpen}>
			<SheetContent>
				<SheetHeader>
					<SheetTitle>Add a field</SheetTitle>
				</SheetHeader>
				<SheetBody />
				<SheetFooter>
					<Button
						variant="primary"
						onClick={() => {
							setOpen(false);
							onConfirm();
						}}
					>
						Add
					</Button>
				</SheetFooter>
			</SheetContent>
		</Sheet>
	);
}

/** Longer than any window's way out (150ms). */
const faded = () => new Promise((done) => setTimeout(done, 400));

describe("a window that was told to close", () => {
	it("a question's button pressed twice 40ms apart does its thing once", async () => {
		const confirmed = vi.fn();
		render(<Question onConfirm={confirmed} />);
		const confirm = page.getByRole("button", { name: "Delete" });
		await expect.element(confirm).toBeVisible();
		await pressTwice(confirm.element(), 40);
		await faded();
		expect(confirmed).toHaveBeenCalledTimes(1);
	});

	it("Enter twice 40ms apart in a field of a form window sends the form once", async () => {
		const sent = vi.fn();
		render(<FormWindow onSend={sent} />);
		await userEvent.click(page.getByRole("button", { name: "Rename" }));
		await userEvent.click(page.getByRole("textbox", { name: "Name" }));
		await keyTwice("Enter", 40);
		await faded();
		expect(sent).toHaveBeenCalledTimes(1);
	});

	it("a form window's pill pressed twice 40ms apart sends the form once", async () => {
		const sent = vi.fn();
		render(<FormWindow onSend={sent} />);
		await userEvent.click(page.getByRole("button", { name: "Rename" }));
		const save = page.getByRole("button", { name: "Save" });
		await expect.element(save).toBeVisible();
		await pressTwice(save.element(), 40);
		await faded();
		expect(sent).toHaveBeenCalledTimes(1);
	});

	it("a sheet's button pressed twice 40ms apart does its thing once", async () => {
		const confirmed = vi.fn();
		render(<Drawer onConfirm={confirmed} />);
		const add = page.getByRole("button", { name: "Add" });
		await expect.element(add).toBeVisible();
		// A sheet takes 250ms to slide in; pressed before it stands still, the press would miss the button.
		await faded();
		await pressTwice(add.element(), 40);
		await faded();
		expect(confirmed).toHaveBeenCalledTimes(1);
	});

	it("Enter held down in a field sends the form once, and does not press the button the focus goes back to", async () => {
		const sent = vi.fn();
		const opened = vi.fn();
		render(<FormWindow onSend={sent} onOpen={opened} />);
		await userEvent.click(page.getByRole("button", { name: "Rename" }));
		await userEvent.click(page.getByRole("textbox", { name: "Name" }));
		try {
			// Held across the fade and well after it: the focus is back on "Rename" by then, and a repeat there would open the window again.
			await holdKey("Enter", { repeats: 12, every: 40 });
		} finally {
			await releaseKey("Enter");
		}
		expect(sent).toHaveBeenCalledTimes(1);
		expect(opened).toHaveBeenCalledTimes(1);
		await expect.element(page.getByRole("dialog")).not.toBeInTheDocument();
		// Let go, the key is a key again.
		expect(document.activeElement).toBe(page.getByRole("button", { name: "Rename" }).element());
		await userEvent.keyboard("{Enter}");
		expect(opened).toHaveBeenCalledTimes(2);
	});
});
