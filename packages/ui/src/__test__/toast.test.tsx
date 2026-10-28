import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Toaster as SiteToaster, toast as siteToast } from "sonner";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Toaster, toast } from "../toast";

afterEach(() => {
	act(() => void toast.dismiss());
});

describe("toast", () => {
	it.each([
		["a toast", (action: { label: string; onClick: () => void }) => toast("Moved to the trash", { action })],
		[
			"an error toast",
			(action: { label: string; onClick: () => void }) => toast.error("Moved to the trash", { action }),
		],
	])("calls the action of %s back and closes it", async (_name, show) => {
		const onClick = vi.fn();
		render(<Toaster />);
		act(() => void show({ label: "Undo", onClick }));
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

	it("is shown once beside a toaster of the site's own, and shows none of the site's toasts", async () => {
		render(
			<>
				<Toaster />
				<SiteToaster />
			</>,
		);
		act(() => {
			toast("Saved");
			toast.error("Could not save");
			toast.dropHint("Drop in Trips");
			siteToast("From the site");
		});
		for (const message of ["Saved", "Could not save", "Drop in Trips", "From the site"])
			expect(await screen.findAllByText(message)).toHaveLength(1);
		// Each toaster has its own list; the site's one holds only the site's toast.
		const lists = screen.getAllByRole("list");
		const [admin, site] = lists.map((list) => list.textContent);
		expect(admin).not.toContain("From the site");
		expect(site).toBe("From the site");
	});
});
