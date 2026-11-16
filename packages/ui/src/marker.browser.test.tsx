import { expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";
import { render } from "../test/render";
import { EditorMargin } from "./editor-overlay";
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

it("a mark hung in the text's margin stays inside the margin where it is narrow, and keeps 32px from the text where there is room", async () => {
	function Column({ margin }: { margin: number }) {
		return (
			<div data-testid="column" style={{ width: 400, overflowX: "clip", position: "relative", paddingLeft: margin }}>
				<div style={{ position: "relative", height: 60 }}>
					<EditorMargin top={4}>
						<Marker tone="changed" aria-label="변경" onClick={() => undefined}>
							변경
						</Marker>
					</EditorMargin>
					Words of the text.
				</div>
			</div>
		);
	}
	const host = render(<Column margin={120} />);
	const mark = () => page.getByRole("button", { name: "변경" }).element().getBoundingClientRect();
	const text = () => (host.querySelector("[data-testid=column] > div") as HTMLElement).getBoundingClientRect();
	await expect.poll(() => text().left - mark().right).toBeCloseTo(32, 0);
	host.remove();
	const narrow = render(<Column margin={50} />);
	const column = () => (narrow.querySelector("[data-testid=column]") as HTMLElement).getBoundingClientRect();
	const small = () => page.getByRole("button", { name: "변경" }).element().getBoundingClientRect();
	await expect.poll(() => small().left - column().left).toBeGreaterThanOrEqual(-1);
});
