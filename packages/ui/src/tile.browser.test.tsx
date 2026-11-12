import { expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";
import { render } from "../test/render";
import { FilePreview, Tile } from "./index";

/** The shadows a box paints, as the browser computed them. */
const shadows = (element: Element) =>
	getComputedStyle(element)
		.boxShadow.split(/,(?![^(]*\))/)
		.map((shadow) => shadow.trim());

it("a picked tile's focus is its own ring stepped 2px off the picture: ink stays ink, and a proposal's blue stays blue", async () => {
	const host = render(
		<div className="grid w-96 grid-cols-3 gap-monti-16 p-monti-8">
			<Tile title="picked.png" preview={<FilePreview ext="PNG" />} selected />
			<Tile title="proposed.png" preview={<FilePreview ext="PNG" />} selected proposal="봄 햇살이 드는 책상" />
			<Tile title="open.png" preview={<FilePreview ext="PNG" />} current proposal="노을 진 산" />
		</div>,
	);
	// The colours as the page resolves them.
	const colourOf = (name: string) => {
		const probe = document.createElement("span");
		probe.className = `border ${name}`;
		host.append(probe);
		return getComputedStyle(probe).borderTopColor;
	};
	const [ink, blue] = ["border-monti-contrast", "border-monti-proposal"].map(colourOf);
	const paper = getComputedStyle(host).backgroundColor;
	for (const [name, colour] of [
		["picked.png", ink],
		["proposed.png", blue],
		["open.png", blue],
	] as const) {
		const button = page.getByRole("button", { name: new RegExp(name.replace(".", "\\.")) });
		await expect.element(button).toBeVisible();
		const picture = button.element().firstElementChild as HTMLElement;
		// At rest: the state's ring at the picture's edge.
		expect(shadows(picture).filter((shadow) => shadow.startsWith(colour))).toEqual([`${colour} 0px 0px 0px 2px`]);
		await userEvent.keyboard("{Tab}");
		await expect.element(button).toHaveFocus();
		expect(button.element().matches(":focus-visible")).toBe(true);
		// Under the keyboard: 2px of the page's ground, then the same ring in the same colour.
		const focused = shadows(picture);
		expect(focused.filter((shadow) => shadow.startsWith(colour))).toEqual([`${colour} 0px 0px 0px 4px`]);
		expect(focused).toContain(`${paper} 0px 0px 0px 2px`);
	}
});
