import type { CSSProperties } from "react";

/**
 * 이미지 자르기(crop) 및 회전(rotate) 순수 함수(c-editor.md §1.1).
 *
 * - 원본 파일은 그대로 두고 `::image`에 표시 속성 `crop="x,y,w,h"`과 `rotate="90|180|270"`을 쓴다.
 * - crop: 원본 기준 백분율(0~100, 소수 둘째 자리까지). 없거나 전체(0,0,100,100)는 회전 없음/전체.
 * - rotate: 시계 방향(90 | 180 | 270). 없거나 0은 회전 없음.
 * - 사이트의 공개 이미지 렌더러와 관리자 편집기의 이미지 블록이
 *   같은 함수를 사용해 CSS 스타일을 계산한다. 잘못된 값은 무시(너비 규칙과 동일).
 */

export interface CropBox {
	/** 좌측 시작 위치 (0~100 %) */
	x: number;
	/** 상단 시작 위치 (0~100 %) */
	y: number;
	/** 자르기 영역 너비 (0~100 %) */
	width: number;
	/** 자르기 영역 높이 (0~100 %) */
	height: number;
}

export type RotateDegree = 90 | 180 | 270;

const round2 = (n: number): number => Math.round(n * 100) / 100;
const round4 = (n: number): number => Math.round(n * 10000) / 10000;

const CROP_REGEX =
	/^\s*(\d+(?:\.\d{1,2})?)\s*,\s*(\d+(?:\.\d{1,2})?)\s*,\s*(\d+(?:\.\d{1,2})?)\s*,\s*(\d+(?:\.\d{1,2})?)\s*$/;
const ROTATE_REGEX = /^(?:0|90|180|270)$/;

/** 모서리를 기준으로 반올림해 `x + width`, `y + height`가 100%를 넘지 않게 한다. */
export function roundCropBox(box: CropBox): CropBox {
	const x = round2(box.x);
	const y = round2(box.y);
	return {
		x,
		y,
		width: round2(Math.min(round2(box.x + box.width), 100) - x),
		height: round2(Math.min(round2(box.y + box.height), 100) - y),
	};
}

/** `crop="x,y,w,h"` 문자열을 파싱한다. 잘못된 형식이면 null을 반환한다. */
export function parseCrop(value: unknown): CropBox | null {
	if (typeof value !== "string") return null;
	const match = CROP_REGEX.exec(value);
	if (!match) return null;

	const rawX = Number(match[1]);
	const rawY = Number(match[2]);
	const rawWidth = Number(match[3]);
	const rawHeight = Number(match[4]);
	if (!Number.isFinite(rawX) || !Number.isFinite(rawY) || !Number.isFinite(rawWidth) || !Number.isFinite(rawHeight)) {
		return null;
	}

	const x = round2(rawX);
	const y = round2(rawY);
	const width = round2(rawWidth);
	const height = round2(rawHeight);

	// 범위 및 반올림 후 유효성 검증:
	// 0 <= x < 100, 0 <= y < 100, 0 < w <= 100, 0 < h <= 100, x + w <= 100, y + h <= 100
	if (x < 0 || x >= 100 || y < 0 || y >= 100) return null;
	if (width <= 0 || width > 100 || height <= 0 || height > 100) return null;
	if (round2(x + width) > 100 || round2(y + height) > 100) return null;

	return {
		x,
		y,
		width,
		height,
	};
}

/** `rotate="90|180|270"` 문자열 또는 숫자를 파싱한다. 0이나 잘못된 값이면 null을 반환한다. */
export function parseRotate(value: unknown): RotateDegree | null {
	if (value === null || value === undefined || value === "") return null;
	const str = typeof value === "number" ? String(value) : typeof value === "string" ? value.trim() : "";
	if (!ROTATE_REGEX.test(str)) return null;
	const num = Number(str);
	if (num === 90 || num === 180 || num === 270) return num;
	return null;
}

/** CropBox를 `crop="x,y,w,h"` 문자열로 직렬화한다 (소수 둘째 자리). */
export function formatCrop(crop: CropBox): string {
	return `${round2(crop.x)},${round2(crop.y)},${round2(crop.width)},${round2(crop.height)}`;
}

/** 전체 이미지(자르기 없음)인지 확인한다. */
export function isFullCrop(crop: CropBox | null): boolean {
	if (!crop) return true;
	return crop.x === 0 && crop.y === 0 && crop.width === 100 && crop.height === 100;
}

/** 유효한 자르기 속성값인지 확인한다. */
export function isValidCrop(value: unknown): boolean {
	if (value === null || value === undefined || value === "") return true;
	return parseCrop(value) !== null;
}

/** 유효한 회전 속성값인지 확인한다. 0·빈값·90·180·270만 유효하다. */
export function isValidRotate(value: unknown): boolean {
	if (value === null || value === undefined || value === "" || value === "0" || value === 0) return true;
	return parseRotate(value) !== null;
}

export interface ImageTransformStyles {
	wrapperStyle: CSSProperties;
	imageStyle: CSSProperties;
	isTransformed: boolean;
	crop: CropBox | null;
	rotate: RotateDegree | null;
}

export interface ImageTransformOptions {
	crop?: string | null;
	rotate?: string | number | null;
	/** 원본 이미지의 가로세로 비율 (naturalWidth / naturalHeight). 알 수 없으면 1로 가정. */
	aspectRatio?: number | null;
}

/**
 * 자르기·회전 CSS 스타일을 계산한다.
 *
 * - crop: wrapper `overflow: hidden` + `aspect-ratio` + img 확대·이동(CSS)
 * - rotate: `transform`으로 회전 (90도·270도는 가로세로 비율 교환)
 * - 잘못된 값은 무시(스타일 미적용).
 */
export function computeImageTransform(options: ImageTransformOptions): ImageTransformStyles {
	const rawCrop = parseCrop(options.crop);
	const crop = isFullCrop(rawCrop) ? null : rawCrop;
	const rotate = parseRotate(options.rotate);

	if (!crop && !rotate) {
		return {
			wrapperStyle: {},
			imageStyle: {},
			isTransformed: false,
			crop: null,
			rotate: null,
		};
	}

	const w = crop ? crop.width : 100;
	const h = crop ? crop.height : 100;
	const x = crop ? crop.x : 0;
	const y = crop ? crop.y : 0;

	// 원본 이미지 비율 (가로 / 세로). 주어지지 않으면 w / h를 비율로 쓴다.
	const baseAspect = typeof options.aspectRatio === "number" && options.aspectRatio > 0 ? options.aspectRatio : 1;
	const cropAspect = (w / h) * baseAspect;

	const isRotated90or270 = rotate === 90 || rotate === 270;
	const finalAspect = isRotated90or270 ? 1 / cropAspect : cropAspect;

	// 자르기 영역 중심점의 원본 이미지 내 중심점(50%) 대비 편차
	const dx = x + w / 2 - 50;
	const dy = y + h / 2 - 50;

	const wrapperStyle: CSSProperties = {
		position: "relative",
		overflow: "hidden",
		aspectRatio: round4(finalAspect),
	};

	let imageStyle: CSSProperties;

	if (isRotated90or270) {
		imageStyle = {
			position: "absolute",
			top: "50%",
			left: "50%",
			width: `${round4((100 / h) * baseAspect * 100)}%`,
			height: `${round4((100 / (w * baseAspect)) * 100)}%`,
			maxWidth: "none",
			maxHeight: "none",
			transform: `translate(-50%, -50%) rotate(${rotate}deg) translate(${round4(-dx)}%, ${round4(-dy)}%)`,
		};
	} else {
		const rotateTransform = rotate === 180 ? " rotate(180deg)" : "";
		imageStyle = {
			position: "absolute",
			top: "50%",
			left: "50%",
			width: `${round4((100 / w) * 100)}%`,
			height: `${round4((100 / h) * 100)}%`,
			maxWidth: "none",
			maxHeight: "none",
			transform: `translate(-50%, -50%)${rotateTransform} translate(${round4(-dx)}%, ${round4(-dy)}%)`,
		};
	}

	return {
		wrapperStyle,
		imageStyle,
		isTransformed: true,
		crop,
		rotate,
	};
}

/**
 * 너비를 지정하지 않은 변환 이미지의 표시 너비(px). 변환이 없을 때처럼 **보이는 영역의 원본 크기**로 보인다.
 * 원본 크기를 아직 모르면 `null` — 호출자는 그동안 부모 폭을 쓴다(0으로 줄어드는 것을 막는다).
 */
export function intrinsicDisplayWidth(
	transform: Pick<ImageTransformStyles, "crop" | "rotate">,
	natural: { width: number; height: number } | null,
): number | null {
	if (!natural || natural.width <= 0 || natural.height <= 0) return null;
	const cropWidth = transform.crop?.width ?? 100;
	const cropHeight = transform.crop?.height ?? 100;
	const sideways = transform.rotate === 90 || transform.rotate === 270;
	const width = sideways ? (natural.height * cropHeight) / 100 : (natural.width * cropWidth) / 100;
	return Math.max(1, Math.round(width));
}
