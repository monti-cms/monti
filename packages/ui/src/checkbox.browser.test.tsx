import { expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";
import { settled } from "../../../testing/measure";
import { render } from "../test/render";
import { Checkbox } from "./checkbox";
import { Option } from "./option";

it("a wrong check stays red under the pointer and the keyboard at once, and the focus is drawn beside the red, not instead of it", async () => {
	const host = render(
		<Option>
			<Checkbox aria-invalid />
			약관에 동의
		</Option>,
	);
	// The error's red as the page resolves it.
	const probe = document.createElement("span");
	probe.className = "border border-monti-danger";
	host.append(probe);
	const red = getComputedStyle(probe).borderTopColor;

	const check = page.getByRole("checkbox", { name: "약관에 동의" });
	await expect.element(check).toBeVisible();
	const box = check.element();
	const drawn = () => {
		const style = getComputedStyle(box);
		return {
			line: style.borderTopColor,
			redRing: style.boxShadow
				.split(/,(?![^(]*\))/)
				.some((shadow) => shadow.includes(red) && / 2px$/.test(shadow.trim())),
			// A line around is there only with a style; its width and offset say where.
			around:
				style.outlineStyle === "none" ? "none" : `${style.outlineStyle} ${style.outlineWidth} ${style.outlineOffset}`,
		};
	};
	expect(drawn()).toEqual({ line: red, redRing: true, around: "none" });

	await userEvent.keyboard("{Tab}");
	await expect.element(check).toHaveFocus();
	expect(box.matches(":focus-visible")).toBe(true);
	await settled();
	// The focus: a line around, outside the red ring. The red line and the red ring are still there.
	expect(drawn()).toEqual({ line: red, redRing: true, around: "solid 2px 2px" });

	await userEvent.hover(page.getByText("약관에 동의"));
	expect(box.closest("label")?.matches(":hover")).toBe(true);
	// The line's colour fades to where it is going: read it there.
	await settled();
	expect(drawn()).toEqual({ line: red, redRing: true, around: "solid 2px 2px" });
});
