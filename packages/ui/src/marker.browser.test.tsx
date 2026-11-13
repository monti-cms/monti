import { expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";
import { render } from "../test/render";
import { Marker } from "./marker";

it("a request's mark is the assistant's blue with its ✦, and a mark that opens its card goes a step darker under the pointer", async () => {
	const host = render(
		<>
			<Marker tone="request" aria-label="요청" onClick={() => undefined}>
				1
			</Marker>
			<Marker tone="changed" aria-label="원문 변경" onClick={() => undefined}>
				변경
			</Marker>
		</>,
	);
	const probe = document.createElement("span");
	probe.className = "text-monti-proposal";
	host.append(probe);
	const blue = getComputedStyle(probe).color;

	const request = page.getByRole("button", { name: "요청" });
	await expect.element(request).toBeVisible();
	expect(getComputedStyle(request.element()).color).toBe(blue);
	expect(request.element().querySelector("svg")).not.toBeNull();

	for (const mark of [request, page.getByRole("button", { name: "원문 변경" })]) {
		expect(getComputedStyle(mark.element()).boxShadow).toBe("none");
		await userEvent.hover(mark);
		await expect.poll(() => getComputedStyle(mark.element()).boxShadow).toContain("inset");
	}
});
