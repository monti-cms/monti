import { act, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createTestRouter } from "../../../test/router";
import { useUnsavedGuard } from "../use-unsaved-guard";

function Screen({ dirty, onNavigate }: { dirty: boolean; onNavigate: () => void }) {
	const { dialog } = useUnsavedGuard(dirty);
	return (
		<div>
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
	it("lets a click on an in-app link through while nothing is unsaved", () => {
		const onNavigate = vi.fn();
		createTestRouter().render(<Screen dirty={false} onNavigate={onNavigate} />);
		act(() => screen.getByText("media").click());
		expect(onNavigate).toHaveBeenCalledOnce();
	});

	it("asks first when something is unsaved, and goes on only when the person discards", async () => {
		const onNavigate = vi.fn();
		createTestRouter().render(<Screen dirty onNavigate={onNavigate} />);
		act(() => screen.getByText("media").click());
		expect(onNavigate).not.toHaveBeenCalled();
		const discard = await screen.findByRole("button", { name: /버리기|Discard/ });
		act(() => discard.click());
		await waitFor(() => expect(onNavigate).toHaveBeenCalledOnce());
	});

	it("stays when the person cancels", async () => {
		const onNavigate = vi.fn();
		createTestRouter().render(<Screen dirty onNavigate={onNavigate} />);
		act(() => screen.getByText("media").click());
		const cancel = await screen.findByRole("button", { name: /취소|Cancel/ });
		act(() => cancel.click());
		expect(onNavigate).not.toHaveBeenCalled();
	});

	it("asks the browser before the page is closed while something is unsaved", () => {
		createTestRouter().render(<Screen dirty onNavigate={() => {}} />);
		const event = new Event("beforeunload", { cancelable: true });
		window.dispatchEvent(event);
		expect(event.defaultPrevented).toBe(true);
	});
});
