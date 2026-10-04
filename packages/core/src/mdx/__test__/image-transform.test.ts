import { describe, expect, it } from "vitest";
import {
	computeImageTransform,
	formatCrop,
	intrinsicDisplayWidth,
	isFullCrop,
	isValidCrop,
	isValidRotate,
	parseCrop,
	parseRotate,
	roundCropBox,
} from "../image-transform";

describe("image-transform pure functions (c-editor.md §1.1)", () => {
	describe("parseCrop & isValidCrop", () => {
		it("올바른 x,y,w,h 퍼센트 문자열을 파싱한다", () => {
			expect(parseCrop("10,20,50.5,40.25")).toEqual({
				x: 10,
				y: 20,
				width: 50.5,
				height: 40.25,
			});
			expect(isValidCrop("10,20,50,40")).toBe(true);
		});

		it("공백이 섞여도 파싱한다", () => {
			expect(parseCrop("  0,  0 , 100 , 100 ")).toEqual({
				x: 0,
				y: 0,
				width: 100,
				height: 100,
			});
		});

		it("범위를 벗어나거나 형식이 잘못된 crop은 null을 반환한다", () => {
			expect(parseCrop("invalid")).toBeNull();
			expect(parseCrop("-1,0,50,50")).toBeNull();
			expect(parseCrop("0,0,0,50")).toBeNull(); // width <= 0
			expect(parseCrop("0,0,105,50")).toBeNull(); // width > 100
			expect(parseCrop("60,0,50,50")).toBeNull(); // x + width > 100
			expect(parseCrop("0,70,50,50")).toBeNull(); // y + height > 100
			expect(parseCrop("0,0,0.001,100")).toBeNull(); // 소수 셋째 자리 이상 또는 반올림 후 0 방지
			expect(parseCrop(null)).toBeNull();
			expect(parseCrop(undefined)).toBeNull();
			expect(isValidCrop("invalid")).toBe(false);
			expect(isValidCrop("")).toBe(true);
		});

		it("formatCrop 및 isFullCrop 동작을 확인한다", () => {
			const crop = { x: 12.345, y: 0.1, width: 45.678, height: 80 };
			expect(formatCrop(crop)).toBe("12.35,0.1,45.68,80");
			expect(isFullCrop({ x: 0, y: 0, width: 100, height: 100 })).toBe(true);
			expect(isFullCrop({ x: 10, y: 0, width: 90, height: 100 })).toBe(false);
			expect(isFullCrop(null)).toBe(true);
		});
	});

	describe("parseRotate & isValidRotate", () => {
		it("90, 180, 270 회전값을 올바르게 파싱한다", () => {
			expect(parseRotate("90")).toBe(90);
			expect(parseRotate(180)).toBe(180);
			expect(parseRotate("270")).toBe(270);
		});

		it("0이나 없으면 null(회전 없음)을 반환한다", () => {
			expect(parseRotate("0")).toBeNull();
			expect(parseRotate(0)).toBeNull();
			expect(parseRotate("")).toBeNull();
			expect(parseRotate(null)).toBeNull();
			expect(parseRotate(undefined)).toBeNull();
		});

		it("잘못된 회전값은 null을 반환한다", () => {
			expect(parseRotate("45")).toBeNull();
			expect(parseRotate("360")).toBeNull();
			expect(parseRotate("foo")).toBeNull();
			expect(parseRotate("90deg")).toBeNull();
		});

		it("isValidRotate 검증", () => {
			expect(isValidRotate("90")).toBe(true);
			expect(isValidRotate(180)).toBe(true);
			expect(isValidRotate("0")).toBe(true);
			expect(isValidRotate("")).toBe(true);
			expect(isValidRotate("45")).toBe(false);
		});
	});

	describe("computeImageTransform", () => {
		it("crop과 rotate가 모두 없거나 전체면 변환되지 않는다", () => {
			const result = computeImageTransform({});
			expect(result.isTransformed).toBe(false);
			expect(result.wrapperStyle).toEqual({});
			expect(result.imageStyle).toEqual({});
		});

		it("잘못된 crop과 rotate는 무시한다", () => {
			const result = computeImageTransform({ crop: "invalid", rotate: "invalid" });
			expect(result.isTransformed).toBe(false);
		});

		it("crop만 적용했을 때 올바른 CSS 스타일을 계산한다", () => {
			const result = computeImageTransform({
				crop: "20,10,50,40",
				aspectRatio: 2, // 1000x500
			});
			expect(result.isTransformed).toBe(true);
			expect(result.wrapperStyle.position).toBe("relative");
			expect(result.wrapperStyle.overflow).toBe("hidden");
			// cropAspect = (50/40) * 2 = 2.5
			expect(result.wrapperStyle.aspectRatio).toBe(2.5);

			expect(result.imageStyle.position).toBe("absolute");
			expect(result.imageStyle.width).toBe("200%"); // 100/50 * 100
			expect(result.imageStyle.height).toBe("250%"); // 100/40 * 100
			expect(result.imageStyle.transform).toContain("translate(-50%, -50%)");
		});

		it("rotate 90/270 적용 시 가로세로 비율이 교환된다", () => {
			const result90 = computeImageTransform({
				crop: "0,0,100,100",
				rotate: "90",
				aspectRatio: 2, // 2:1
			});
			expect(result90.isTransformed).toBe(true);
			// 2:1이 90도 회전하면 1:2 (0.5)
			expect(result90.wrapperStyle.aspectRatio).toBe(0.5);
			expect(result90.imageStyle.transform).toContain("rotate(90deg)");

			const result270 = computeImageTransform({
				rotate: "270",
				aspectRatio: 1.5,
			});
			expect(result270.isTransformed).toBe(true);
			expect(result270.wrapperStyle.aspectRatio).toBeCloseTo(1 / 1.5, 3);
			expect(result270.imageStyle.transform).toContain("rotate(270deg)");
		});

		it("rotate 180 적용 시 가로세로 비율이 유지되고 rotate(180deg)가 들어간다", () => {
			const result = computeImageTransform({
				rotate: 180,
				aspectRatio: 1.6,
			});
			expect(result.isTransformed).toBe(true);
			expect(result.wrapperStyle.aspectRatio).toBe(1.6);
			expect(result.imageStyle.transform).toContain("rotate(180deg)");
		});
	});
});

describe("intrinsicDisplayWidth", () => {
	it("너비 미지정 변환 이미지는 보이는 영역의 원본 너비로 보인다", () => {
		const natural = { width: 400, height: 200 };
		expect(intrinsicDisplayWidth({ crop: { x: 0, y: 0, width: 50, height: 100 }, rotate: null }, natural)).toBe(200);
		expect(intrinsicDisplayWidth({ crop: { x: 0, y: 0, width: 100, height: 50 }, rotate: 90 }, natural)).toBe(100);
		expect(intrinsicDisplayWidth({ crop: null, rotate: 180 }, natural)).toBe(400);
		expect(intrinsicDisplayWidth({ crop: null, rotate: 90 }, null)).toBeNull();
	});

	it("반올림 동률에서도 자르기 영역이 오른쪽·아래 경계를 넘지 않는다", () => {
		const crop = roundCropBox({ x: 12.125, y: 12.125, width: 87.875, height: 87.875 });
		expect(crop).toEqual({ x: 12.13, y: 12.13, width: 87.87, height: 87.87 });
		expect(parseCrop(`${crop.x},${crop.y},${crop.width},${crop.height}`)).toEqual(crop);
	});
});
