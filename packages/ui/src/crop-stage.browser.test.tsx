import { describe, expect, it } from "vitest";
import { render } from "../test/render";
import { Box, CropStage } from "./index";

const cornerLabels = { nw: "왼쪽 위", ne: "오른쪽 위", sw: "왼쪽 아래", se: "오른쪽 아래" };
const WHOLE = { x: 0, y: 0, width: 100, height: 100 };
const box = (slot: string) => document.querySelector<HTMLElement>(`[data-slot=${slot}]`)?.getBoundingClientRect();

describe("CropStage", () => {
	it("T136 with the picture's shape known, the stage stands at it before the picture is in: the crop box is as large as the picture will be, not a dot", async () => {
		// An address with no picture behind it: the picture never comes in.
		render(
			<Box width="sheet">
				<CropStage src="/never-answers.png" alt="" shape={2} crop={WHOLE} cornerLabels={cornerLabels} />
			</Box>,
		);
		await expect.poll(() => box("crop-box")?.width ?? 0).toBeGreaterThan(200);
		const crop = box("crop-box");
		expect(Math.round((crop?.width ?? 0) / (crop?.height ?? 1))).toBe(2);
		// The picture's frame is the part that waits for a picture (`Image`), as large as the stage.
		const frame = box("image");
		expect([Math.round(frame?.width ?? 0), Math.round(frame?.height ?? 0)]).toEqual([
			Math.round(crop?.width ?? 0),
			Math.round(crop?.height ?? 0),
		]);
	});

	it("T136 with no shape known and no picture in yet there is no crop box to take: it comes with the picture", async () => {
		render(
			<Box width="sheet">
				<CropStage src="/never-answers.png" alt="" crop={WHOLE} cornerLabels={cornerLabels} />
			</Box>,
		);
		await expect.poll(() => box("crop-stage")?.width ?? 0).toBeGreaterThan(200);
		expect(document.querySelector("[data-slot=crop-box]")).toBeNull();
	});

	it("once the picture is in, the stage takes the picture's own shape, whatever shape it was told", async () => {
		const canvas = document.createElement("canvas");
		canvas.width = 300;
		canvas.height = 100;
		render(
			<Box width="sheet">
				<CropStage src={canvas.toDataURL()} alt="" shape={1} crop={WHOLE} cornerLabels={cornerLabels} />
			</Box>,
		);
		await expect
			.poll(() => {
				const crop = box("crop-box");
				return crop ? Math.round(crop.width / crop.height) : 0;
			})
			.toBe(3);
	});
});
