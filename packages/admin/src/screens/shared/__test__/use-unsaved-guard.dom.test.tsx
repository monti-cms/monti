import { act, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createTestRouter } from "../../../test/router";
import { useUnsavedGuard } from "../use-unsaved-guard";

function Screen({ dirty, onNavigate }: { dirty: boolean; onNavigate: () => void }) {
	const { dialog } = useUnsavedGuard(dirty);
	return (
		<div>
			<nav data-unsaved-guard="off">
				<a
					href="/admin/settings/locales"
					onClick={(event) => {
						event.preventDefault();
						onNavigate();
					}}
				>
					locales
				</a>
			</nav>
			<a
				href="/admin/media"
				onClick={(event) => {
					event.preventDefault();
					onNavigate();
				}}
			>
				media
			</a>
			{dialog}
		</div>
	);
}

describe("useUnsavedGuard", () => {
	it("WRITE-S6 lets a click on an in-app link through while nothing is unsaved", () => {
		const onNavigate = vi.fn();
		createTestRouter().render(<Screen dirty={false} onNavigate={onNavigate} />);
		act(() => screen.getByText("media").click());
		expect(onNavigate).toHaveBeenCalledOnce();
	});

	it("WRITE-S6 asks first when something is unsaved, and goes on only when the person discards", async () => {
		const onNavigate = vi.fn();
		createTestRouter().render(<Screen dirty onNavigate={onNavigate} />);
		act(() => screen.getByText("media").click());
		expect(onNavigate).not.toHaveBeenCalled();
		const discard = await screen.findByRole("button", { name: /버리기|Discard/ });
		act(() => discard.click());
		await waitFor(() => expect(onNavigate).toHaveBeenCalledOnce());
	});

	it("WRITE-S6 lets links inside an element marked as staying on the screen through without asking", () => {
		const onNavigate = vi.fn();
		createTestRouter().render(<Screen dirty onNavigate={onNavigate} />);
		act(() => screen.getByText("locales").click());
		expect(onNavigate).toHaveBeenCalledOnce();
		expect(screen.queryByRole("button", { name: /버리기|Discard/ })).toBeNull();
	});

	it("WRITE-S6 stays when the person cancels", async () => {
		const onNavigate = vi.fn();
		createTestRouter().render(<Screen dirty onNavigate={onNavigate} />);
		act(() => screen.getByText("media").click());
		const cancel = await screen.findByRole("button", { name: /취소|Cancel/ });
		act(() => cancel.click());
		expect(onNavigate).not.toHaveBeenCalled();
	});

	it("WRITE-S6 asks the browser before the page is closed while something is unsaved", () => {
		createTestRouter().render(<Screen dirty onNavigate={() => {}} />);
		const event = new Event("beforeunload", { cancelable: true });
		window.dispatchEvent(event);
		expect(event.defaultPrevented).toBe(true);
	});
});
