import { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";
import { render } from "../test/render";
import { Banner, ProposalBubble, ProposalBubbleDock, Stack, TextButton, Toaster, toast } from "./index";

afterEach(() => {
	toast.dismiss();
});

/** A screen with the proposal bubble docked at its bottom centre, where the toasts come up too. Taking the proposals takes the bubble away. */
function Screen() {
	const [waiting, setWaiting] = useState(true);
	const [taken, setTaken] = useState(0);
	return (
		<Stack height="screen" gap={0}>
			<Toaster duration={Number.POSITIVE_INFINITY} />
			<output aria-label="taken">{taken}</output>
			{waiting ? (
				<ProposalBubbleDock>
					<ProposalBubble
						name="독일어도 추가해 줘"
						position={1}
						total={1}
						previousLabel="이전 제안"
						nextLabel="다음 제안"
						onPrevious={() => {}}
						onNext={() => {}}
						discardAllLabel="모두 버리기"
						onDiscardAll={() => setWaiting(false)}
						acceptAllLabel="모두 받기"
						onAcceptAll={() => {
							setTaken((count) => count + 1);
							setWaiting(false);
						}}
					/>
				</ProposalBubbleDock>
			) : null}
		</Stack>
	);
}

const box = (element: Element | null) => (element as Element).getBoundingClientRect();
const toastBox = () => box(document.querySelector("[data-sonner-toast]"));

describe("a toast and what is docked at the bottom centre", () => {
	it("while the proposal bubble is shown a toast stands 12px above it and the bubble's buttons take a press; when the bubble is gone the toast is back at 32px", async () => {
		render(<Screen />);
		const accept = page.getByRole("button", { name: "모두 받기" });
		await expect.element(accept).toBeVisible();
		toast("저장했습니다");
		await expect.element(page.getByText("저장했습니다")).toBeVisible();
		const bubble = () => box(document.querySelector("[data-slot=proposal-bubble-dock]")?.firstElementChild ?? null);
		// The two boxes do not meet: the toast ends 12px over the bubble's top.
		await expect.poll(() => Math.round(bubble().top - toastBox().bottom)).toBe(12);
		// A real pointer press on the bubble's button lands on it: nothing is over it.
		const at = box(accept.element());
		expect(document.elementFromPoint(at.left + at.width / 2, at.top + at.height / 2)?.closest("button")).toBe(
			accept.element(),
		);
		await userEvent.click(accept);
		await expect.element(page.getByLabelText("taken")).toHaveTextContent("1");
		// The bubble is gone: the toast comes back down to its own place over the window's edge.
		await expect.element(accept).not.toBeInTheDocument();
		await expect.poll(() => Math.round(window.innerHeight - toastBox().bottom)).toBe(32);
	});

	it("a bar that comes in under the bubble's column moves the bubble up without changing its size: the toast stays 12px over it, shown before or after", async () => {
		function Screen() {
			const [bar, setBar] = useState(false);
			return (
				<Stack height="screen" gap={0}>
					<Toaster duration={Number.POSITIVE_INFINITY} />
					<Stack grow gap={0}>
						<TextButton onClick={() => setBar(true)}>바 보이기</TextButton>
						<ProposalBubbleDock>
							<ProposalBubble
								name="독일어도 추가해 줘"
								position={1}
								total={1}
								previousLabel="이전 제안"
								nextLabel="다음 제안"
								onPrevious={() => {}}
								onNext={() => {}}
								discardAllLabel="모두 버리기"
								onDiscardAll={() => {}}
								acceptAllLabel="모두 받기"
								onAcceptAll={() => {}}
							/>
						</ProposalBubbleDock>
					</Stack>
					{bar ? <Banner title="상태 표시줄" /> : null}
				</Stack>
			);
		}
		render(<Screen />);
		const bubble = () => box(document.querySelector("[data-slot=proposal-bubble-dock]")?.firstElementChild ?? null);
		await expect.element(page.getByRole("button", { name: "모두 받기" })).toBeVisible();
		toast("저장했습니다");
		await expect.element(page.getByText("저장했습니다")).toBeVisible();
		await expect.poll(() => Math.round(bubble().top - toastBox().bottom)).toBe(12);
		const before = bubble();
		await userEvent.click(page.getByRole("button", { name: "바 보이기" }));
		await expect.element(page.getByText("상태 표시줄")).toBeVisible();
		// The bubble went up by the bar's height, the same size as it was; the toast up with it.
		expect(bubble().top).toBeLessThan(before.top);
		expect(Math.round(bubble().height)).toBe(Math.round(before.height));
		await expect.poll(() => Math.round(bubble().top - toastBox().bottom)).toBe(12);
		// A toast shown now stands over the bubble where it is now.
		toast.dismiss();
		await expect.element(page.getByText("저장했습니다")).not.toBeInTheDocument();
		toast("적용했습니다");
		await expect.element(page.getByText("적용했습니다")).toBeVisible();
		await expect.poll(() => Math.round(bubble().top - toastBox().bottom)).toBe(12);
	});

	it("with nothing docked a toast stands 32px over the window's bottom edge", async () => {
		render(<Toaster duration={Number.POSITIVE_INFINITY} />);
		toast("저장했습니다");
		await expect.element(page.getByText("저장했습니다")).toBeVisible();
		await expect.poll(() => Math.round(window.innerHeight - toastBox().bottom)).toBe(32);
	});
});
