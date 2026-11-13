import { expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";
import { render } from "../test/render";
import { FloatingBar, FloatingBarButton } from "./floating-bar";

it("a bar's button pointed at takes the ghost's ground, not the ground of a format that is on", async () => {
	const host = render(
		<FloatingBar aria-label="서식">
			<FloatingBarButton label="굵게" pressed>
				B
			</FloatingBarButton>
			<FloatingBarButton label="기울임" pressed={false}>
				I
			</FloatingBarButton>
		</FloatingBar>,
	);
	const ground = (token: string) => {
		const probe = document.createElement("span");
		probe.className = token;
		host.append(probe);
		return getComputedStyle(probe).backgroundColor;
	};
	const on = page.getByRole("button", { name: "굵게" });
	const off = page.getByRole("button", { name: "기울임" });
	await expect.element(on).toBeVisible();
	expect(getComputedStyle(on.element()).backgroundColor).toBe(ground("bg-monti-selected"));
	await userEvent.hover(off);
	await expect.poll(() => getComputedStyle(off.element()).backgroundColor).toBe(ground("bg-monti-muted"));
	// The one that is on keeps its ground under the pointer.
	await userEvent.hover(on);
	await expect.poll(() => getComputedStyle(on.element()).backgroundColor).toBe(ground("bg-monti-selected"));
});
