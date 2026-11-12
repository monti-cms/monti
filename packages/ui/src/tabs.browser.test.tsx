import { expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";
import { colourAt } from "../test/pixels";
import { render } from "../test/render";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./tabs";

it("a tab panel's ring is painted over what is in it: a first row with a ground does not cover it, and it stays put while the panel scrolls", async () => {
	render(
		<Tabs defaultValue="one" className="h-40">
			<TabsList>
				<TabsTrigger value="one">하나</TabsTrigger>
			</TabsList>
			<TabsContent value="one" scroll>
				<div className="h-monti-control-lg bg-monti-selected">바탕이 있는 첫 줄</div>
				<div className="h-80">긴 내용</div>
			</TabsContent>
		</Tabs>,
	);
	const tabpanel = page.getByRole("tabpanel");
	await expect.element(tabpanel).toBeVisible();
	const panel = tabpanel.element() as HTMLElement;
	// A point of the ring that the first row covers: 1px in from the panel's left edge, at the row's middle.
	const at = [1, 18] as const;
	const ground = await colourAt(panel, ...at);

	await userEvent.keyboard("{Tab}{Tab}");
	await expect.element(tabpanel).toHaveFocus();
	expect(panel.matches(":focus-visible")).toBe(true);
	expect(await colourAt(panel, ...at)).not.toBe(ground);
	// Scrolled, the ring is still at the panel's edge: on the panel, not on what scrolls in it.
	panel.scrollTop = 60;
	expect(panel.scrollTop).toBe(60);
	const ring = await colourAt(panel, ...at);
	panel.blur();
	expect(await colourAt(panel, ...at)).not.toBe(ring);
});
