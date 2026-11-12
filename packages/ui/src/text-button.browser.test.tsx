import { useState } from "react";
import { expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";
import { render } from "../test/render";
import { TextButton } from "./text-button";

/** The ring the keyboard's focus draws now, as the browser computed it. */
const ringOf = (element: Element) => {
	const style = getComputedStyle(element);
	return {
		keyboard: element.matches(":focus-visible"),
		style: style.outlineStyle,
		width: style.outlineWidth,
		offset: style.outlineOffset,
		// The ink's share of the line's colour: "… / 0.5)".
		ink: style.outlineColor.match(/\/\s*([\d.]+)\)$/)?.[1],
	};
};

it("the keyboard's focus draws a ring around a text button's words: a 2px line at half ink, 2px off them", async () => {
	render(
		<p>
			<TextButton variant="underline" quiet size="caption">
				되돌리기
			</TextButton>{" "}
			<TextButton href="#list">목록에서 보기</TextButton>
		</p>,
	);
	const button = page.getByRole("button", { name: "되돌리기" });
	await expect.element(button).toBeVisible();
	// A width without a style draws nothing: `outline-none` beside `outline-2` left every text button without a ring.
	await userEvent.keyboard("{Tab}");
	await expect.element(button).toHaveFocus();
	expect(ringOf(button.element())).toEqual({ keyboard: true, style: "solid", width: "2px", offset: "2px", ink: "0.5" });

	const link = page.getByRole("link", { name: "목록에서 보기" });
	await userEvent.keyboard("{Tab}");
	await expect.element(link).toHaveFocus();
	expect(ringOf(link.element())).toEqual({ keyboard: true, style: "solid", width: "2px", offset: "2px", ink: "0.5" });
});

it("a press with the pointer draws no ring", async () => {
	render(<TextButton>취소</TextButton>);
	const button = page.getByRole("button", { name: "취소" });
	await button.click();
	await expect.element(button).toHaveFocus();
	const { keyboard, style } = ringOf(button.element());
	expect(keyboard).toBe(false);
	expect(style).toBe("none");
});

it("a text button that is working keeps the keyboard's focus, says it is busy, and hears no second press", async () => {
	let presses = 0;
	function Loads() {
		const [loading, setLoading] = useState(false);
		return (
			<TextButton
				loading={loading}
				onClick={() => {
					presses += 1;
					setLoading(true);
				}}
			>
				불러오기
			</TextButton>
		);
	}
	render(<Loads />);
	const button = page.getByRole("button", { name: "불러오기" });
	await userEvent.keyboard("{Tab}");
	await expect.element(button).toHaveFocus();
	await userEvent.keyboard("{Enter}");
	await expect.element(button).toHaveAttribute("aria-busy", "true");
	// A browser takes the focus from a button that turns `disabled`, a moment later: wait for that moment.
	await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(() => done(null))));
	await expect.element(button).toHaveFocus();
	await expect.element(button).toHaveAttribute("aria-disabled", "true");
	await userEvent.keyboard("{Enter}");
	await userEvent.keyboard(" ");
	expect(presses).toBe(1);
});

it("working, it stops what it is drawn as from acting too: a native child's own press, and a link's own press and address", async () => {
	const pressed: string[] = [];
	// A link with a press of its own, as a router's link is; its words are the text button's.
	// biome-ignore lint/a11y/useAnchorContent: the text button's children go in the link.
	// biome-ignore lint/a11y/useValidAnchor: a router's link navigates in its own press handler.
	const link = <a href="#moved" onClick={() => pressed.push("link")} />;
	render(
		<p>
			<TextButton loading render={<button type="button" onClick={() => pressed.push("child")} />}>
				자식 버튼
			</TextButton>{" "}
			<TextButton loading render={link}>
				자식 링크
			</TextButton>{" "}
			<TextButton loading href="#gone" onClick={() => pressed.push("own")}>
				제 링크
			</TextButton>
		</p>,
	);
	const before = location.hash;
	for (const name of ["자식 버튼", "자식 링크", "제 링크"]) {
		const control = page.getByText(name);
		await expect.element(control).toBeVisible();
		// The keyboard's press (a pointer's is kept off by the part's `pointer-events: none`), and a press sent straight to it.
		(control.element() as HTMLElement).focus();
		await userEvent.keyboard("{Enter}");
		(control.element() as HTMLElement).click();
	}
	expect(pressed).toEqual([]);
	expect(location.hash).toBe(before);
});
