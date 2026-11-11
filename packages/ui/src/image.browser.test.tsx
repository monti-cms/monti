import { describe, expect, it } from "vitest";
import { render } from "../test/render";
import { Box, Image } from "./index";

describe("Image", () => {
	it("with its shape known, the frame stands at that shape before the picture is in: what is under it does not move when it comes", async () => {
		// An address that answers nothing for as long as the test runs: the picture never comes in.
		render(
			<Box width="sheet">
				<Image src="/never-answers.png" alt="" ratio="auto" shape={2} />
				<p>아래 글</p>
			</Box>,
		);
		const frame = () => document.querySelector<HTMLElement>("[data-slot=image]");
		await expect.poll(() => frame()?.getBoundingClientRect().width ?? 0).toBeGreaterThan(100);
		const box = frame()?.getBoundingClientRect();
		expect(Math.round(box?.height ?? 0)).toBe(Math.round((box?.width ?? 0) / 2));
	});
});
