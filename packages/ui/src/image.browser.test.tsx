import { describe, expect, it } from "vitest";
import { render } from "../test/render";
import { Box, Image } from "./index";

describe("Image", () => {
	it("with its shape known, the frame stands at that shape before the picture is in: what is under it does not move when it comes", async () => {
		// An address with no picture behind it: the picture never comes in.
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

	it("the frame waits until its picture is in: it breathes while the picture is on its way, and is still once it is in or when there is none", async () => {
		const canvas = document.createElement("canvas");
		canvas.width = canvas.height = 4;
		render(
			<Box width="sheet">
				<Image src={canvas.toDataURL()} alt="온 그림" ratio="wide" />
				<Image alt="없음" ratio="wide" />
				{/* Far under the window, a picture read only when it is near (`loading="lazy"`) stays on its way for as long as the test runs. */}
				<div style={{ height: 30000 }} />
				<Image src={`${canvas.toDataURL()}#far`} alt="오는 중" ratio="wide" />
			</Box>,
		);
		const frames = () => [...document.querySelectorAll<HTMLElement>("[data-slot=image]")];
		await expect.poll(() => frames().map((frame) => frame.dataset.waiting ?? "")).toEqual(["", "", "true"]);
		const [arrived, , onItsWay] = frames();
		expect(getComputedStyle(onItsWay as HTMLElement).animationName).toBe("monti-wait");
		expect(getComputedStyle(onItsWay as HTMLElement).animationIterationCount).toBe("infinite");
		expect(getComputedStyle(arrived as HTMLElement).animationName).toBe("none");
	});
});
