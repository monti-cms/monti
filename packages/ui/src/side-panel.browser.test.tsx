import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { render } from "../test/render";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	Button,
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
	SidePanel,
	TextButton,
} from "./index";

/** Three rows that each open the panel beside them, as a list's rows do; the last also from its menu. */
function Screen({ onAct }: { onAct?: () => void }) {
	const [open, setOpen] = useState<string | null>(null);
	const [asking, setAsking] = useState(false);
	return (
		<>
			<Button onClick={() => setOpen("첫 번째")}>첫 번째 열기</Button>
			<Button onClick={() => setOpen("두 번째")}>두 번째 열기</Button>
			<Button onClick={() => setOpen("세 번째")}>세 번째 열기</Button>
			<DropdownMenu>
				<DropdownMenuTrigger render={<Button>메뉴</Button>} />
				<DropdownMenuContent>
					<DropdownMenuItem onClick={() => setOpen("메뉴에서")}>자세히</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>
			{open && (
				<SidePanel title={open} onClose={() => setOpen(null)}>
					<TextButton onClick={onAct}>패널 안의 동작</TextButton>
					<TextButton onClick={() => setAsking(true)}>묻기</TextButton>
				</SidePanel>
			)}
			<AlertDialog open={asking} onOpenChange={(next) => !next && setAsking(false)}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>정말 할까요?</AlertDialogTitle>
						<AlertDialogDescription>되돌릴 수 없습니다.</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>닫기</AlertDialogCancel>
						<AlertDialogAction>하기</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	);
}

const opener = (name: string) => page.getByRole("button", { name });
const panel = () => page.getByRole("complementary");
const close = () => panel().getByRole("button", { name: "Close" });
const tabTo = async (target: () => Element) => {
	for (let presses = 0; presses < 30 && document.activeElement !== target(); presses++) await userEvent.tab();
	expect(document.activeElement).toBe(target());
};

describe("SidePanel", () => {
	it("closed with the keyboard, it gives focus back to what opened it", async () => {
		render(<Screen />);
		await expect.element(opener("두 번째 열기")).toBeVisible();
		(opener("두 번째 열기").element() as HTMLElement).focus();
		await userEvent.keyboard("{Enter}");
		await expect.element(panel()).toBeVisible();
		await tabTo(() => close().element());
		await userEvent.keyboard("{Enter}");
		await expect.element(panel()).not.toBeInTheDocument();
		await expect.element(opener("두 번째 열기")).toHaveFocus();
	});

	it("what focus passed on its way into the panel is not its opener: closed from there, focus is back on the row that opened it", async () => {
		render(<Screen />);
		await expect.element(opener("첫 번째 열기")).toBeVisible();
		(opener("첫 번째 열기").element() as HTMLElement).focus();
		await userEvent.keyboard("{Enter}");
		await expect.element(panel()).toBeVisible();
		// With Tab past the other rows and the menu's button, into the panel, to its ×.
		await tabTo(() => close().element());
		await userEvent.keyboard("{Enter}");
		await expect.element(opener("첫 번째 열기")).toHaveFocus();
	});

	it("another row opened into the same panel is its opener from then on", async () => {
		render(<Screen />);
		await userEvent.click(opener("첫 번째 열기"));
		await expect.element(panel()).toHaveTextContent("첫 번째");
		(opener("세 번째 열기").element() as HTMLElement).focus();
		await userEvent.keyboard("{Enter}");
		await expect.element(panel()).toHaveTextContent("세 번째");
		await tabTo(() => close().element());
		await userEvent.keyboard("{Enter}");
		await expect.element(opener("세 번째 열기")).toHaveFocus();
	});

	it("opened from a menu's item, which leaves with its menu, it gives focus back to the menu's button", async () => {
		render(<Screen />);
		await expect.element(opener("메뉴")).toBeVisible();
		(opener("메뉴").element() as HTMLElement).focus();
		await userEvent.keyboard("{Enter}");
		await expect.element(page.getByRole("menuitem", { name: "자세히" })).toBeVisible();
		await userEvent.keyboard("{Enter}");
		await expect.element(panel()).toHaveTextContent("메뉴에서");
		await expect.element(opener("메뉴")).toHaveFocus();
		await tabTo(() => close().element());
		await userEvent.keyboard("{Enter}");
		await expect.element(opener("메뉴")).toHaveFocus();
	});

	it("closed with the pointer, it moves focus nowhere", async () => {
		render(<Screen />);
		await userEvent.click(opener("첫 번째 열기"));
		await userEvent.click(close());
		await expect.element(panel()).not.toBeInTheDocument();
		expect(document.activeElement).toBe(document.body);
	});

	it("a question opened from inside it keeps Tab and Shift+Tab inside, also for keys quicker than a frame, and nothing behind it is pressed", async () => {
		const acted = vi.fn();
		render(<Screen onAct={acted} />);
		await userEvent.click(opener("첫 번째 열기"));
		const ask = () => panel().getByRole("button", { name: "묻기" });
		await tabTo(() => ask().element());
		await userEvent.keyboard("{Enter}");
		const question = page.getByRole("alertdialog");
		await expect.element(question).toBeVisible();
		const inside = () => question.element().contains(document.activeElement);
		// The keys come before the next frame is drawn (a quick or a held key): the frame is held back for as long as they are pressed.
		const frames: FrameRequestCallback[] = [];
		const held = vi.spyOn(window, "requestAnimationFrame").mockImplementation((run) => frames.push(run));
		for (let presses = 0; presses < 5; presses++) {
			await userEvent.keyboard("{Shift>}{Tab}{/Shift}");
			expect(inside()).toBe(true);
		}
		await expect.element(question.getByRole("button", { name: "하기" })).toHaveFocus();
		// And forward, past the last button.
		for (let presses = 0; presses < 5; presses++) {
			await userEvent.keyboard("{Tab}");
			expect(inside()).toBe(true);
		}
		await expect.element(question.getByRole("button", { name: "닫기" })).toHaveFocus();
		held.mockRestore();
		for (const run of frames) run(performance.now());
		expect(inside()).toBe(true);
		// Enter presses the question's own button, never the panel's.
		await userEvent.keyboard("{Enter}");
		await expect.element(question).not.toBeInTheDocument();
		expect(acted).not.toHaveBeenCalled();
	});
});
