import { expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";
import { settled } from "../../../testing/measure";
import { render } from "../test/render";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./select";

const ITEMS = [{ value: "notice", label: "공지사항" }];
/** A ring: a shadow of 2px with no offset and no blur, in a colour that shows. */
const ringed = (element: Element) =>
	getComputedStyle(element)
		.boxShadow.split(/,(?![^(]*\))/)
		.some((shadow) => / 0px 0px 0px 2px$/.test(shadow.trim()) && !/, 0\)|\/ 0\)/.test(shadow));

it("a select keeps its error's red line and its proposal's blue line under the pointer and the keyboard, and the focus is a ring added to them", async () => {
	const host = render(
		<div className="flex gap-monti-16">
			<Select items={ITEMS} defaultValue="notice">
				<SelectTrigger aria-invalid aria-label="틀린 값">
					<SelectValue />
				</SelectTrigger>
				<SelectContent>
					<SelectItem value="notice">공지사항</SelectItem>
				</SelectContent>
			</Select>
			<Select items={ITEMS} defaultValue="notice">
				<SelectTrigger proposal aria-label="제안한 값">
					<SelectValue />
				</SelectTrigger>
				<SelectContent>
					<SelectItem value="notice">공지사항</SelectItem>
				</SelectContent>
			</Select>
			<Select items={ITEMS} defaultValue="notice">
				<SelectTrigger aria-label="보통 값">
					<SelectValue />
				</SelectTrigger>
				<SelectContent>
					<SelectItem value="notice">공지사항</SelectItem>
				</SelectContent>
			</Select>
		</div>,
	);
	// The colours as the page resolves them.
	const colourOf = (name: string) => {
		const probe = document.createElement("span");
		probe.className = `border ${name}`;
		host.append(probe);
		return getComputedStyle(probe).borderTopColor;
	};
	const [red, blue, ink] = ["border-monti-danger", "border-monti-proposal", "border-monti-contrast"].map(colourOf);
	const line = (element: Element) => getComputedStyle(element).borderBottomColor;

	for (const [name, colour] of [
		["틀린 값", red],
		["제안한 값", blue],
	] as const) {
		const trigger = page.getByRole("combobox", { name });
		await expect.element(trigger).toBeVisible();
		expect([line(trigger.element()), ringed(trigger.element())]).toEqual([colour, false]);
		// Under the pointer the field takes its tint, and the line keeps the state's colour.
		await userEvent.hover(trigger);
		await settled();
		expect(line(trigger.element())).toBe(colour);
		await userEvent.unhover(trigger);
		await userEvent.keyboard("{Tab}");
		await expect.element(trigger).toHaveFocus();
		await settled();
		// The state's colour is not replaced by the focus's ink, and the focus is not hidden by the state: a ring is added.
		expect([line(trigger.element()), ringed(trigger.element())]).toEqual([colour, true]);
	}
	// Without a state the line itself turns ink, as a field's does: no ring.
	const plain = page.getByRole("combobox", { name: "보통 값" });
	await userEvent.keyboard("{Tab}");
	await expect.element(plain).toHaveFocus();
	await settled();
	expect([line(plain.element()), ringed(plain.element())]).toEqual([ink, false]);
});
