import { expect, it } from "vitest";
import { page } from "vitest/browser";
import { render } from "../test/render";
import { MemoCard } from "./memo-card";

const reply = {
	placeholder: "이어서 요청",
	value: "더 짧게",
	onValueChange: () => undefined,
	onSend: () => undefined,
	sendLabel: "보내기",
};

it("a card with the black '받기' in its head sends with a ghost ↑: one black control on a surface", async () => {
	render(
		<MemoCard
			discardLabel="버리기"
			onDiscard={() => undefined}
			acceptLabel="받기"
			onAccept={() => undefined}
			reply={reply}
		/>,
	);
	await expect.element(page.getByRole("button", { name: "보내기" })).toBeVisible();
	expect(page.getByRole("button", { name: "보내기" }).element().getAttribute("data-variant")).toBe("ghost");
});

it("a card with nothing to accept keeps the black ↑, the one black control it has", async () => {
	render(<MemoCard reply={reply} />);
	await expect.element(page.getByRole("button", { name: "보내기" })).toBeVisible();
	expect(page.getByRole("button", { name: "보내기" }).element().getAttribute("data-variant")).toBe("primary");
});
