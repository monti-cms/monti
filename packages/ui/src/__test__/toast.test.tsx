import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Toaster, toast } from "../toast";

afterEach(() => {
	act(() => void toast.dismiss());
});

describe("toast", () => {
	it("shows its message", async () => {
		render(<Toaster />);
		act(() => void toast("Saved"));
		expect(await screen.findByText("Saved")).toBeTruthy();
		expect(screen.queryByRole("button")).toBeNull();
	});

	it("calls the action back and closes the toast", async () => {
		const onClick = vi.fn();
		render(<Toaster />);
		act(() => void toast("Moved to the trash", { action: { label: "Undo", onClick } }));
		fireEvent.click(await screen.findByRole("button", { name: "Undo" }));
		expect(onClick).toHaveBeenCalledTimes(1);
		await waitFor(() => expect(screen.queryByText("Moved to the trash")).toBeNull());
	});

	it("replaces the message of an open toast shown again with the same id", async () => {
		render(<Toaster duration={Number.POSITIVE_INFINITY} />);
		let id: string | number = "";
		act(() => {
			id = toast("Uploading 10%", { id: "upload" });
		});
		expect(await screen.findByText("Uploading 10%")).toBeTruthy();
		act(() => void toast("Uploaded", { id }));
		expect(await screen.findByText("Uploaded")).toBeTruthy();
		expect(screen.queryByText("Uploading 10%")).toBeNull();
	});

	it("shows the drop hint with the name in bold, and closes it on dismiss", async () => {
		render(<Toaster />);
		let id: string | number = "";
		act(() => {
			id = toast.dropHint(
				<>
					Drop in <b>Trips</b>
				</>,
			);
		});
		expect((await screen.findByText("Trips")).tagName).toBe("B");
		act(() => void toast.dismiss(id));
		await waitFor(() => expect(screen.queryByText("Trips")).toBeNull());
	});
});
