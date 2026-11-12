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
