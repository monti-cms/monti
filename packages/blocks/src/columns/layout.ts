/**
 * 단 나누기 너비(`::::columns{widths="60,40"}`). 단마다 비율(%)을 쉼표로 적는다.
 * 공개 렌더러와 에디터가 같은 규칙으로 읽는다. 비우거나 단 수와 맞지 않으면 똑같이 나눈다.
 */

/** 한 단의 최소 비율(%). 끌어서 조절할 때 이보다 좁히지 않는다. */
export const MIN_COLUMN_PERCENT = 10;

/** `widths`를 단별 비율로 읽는다. 단 수와 다르거나 잘못된 값이 있으면 null(똑같이 나눔)이다. */
export const parseColumnWidths = (value: unknown, count: number): number[] | null => {
	if (typeof value !== "string" || !value.trim()) return null;
	const widths = value.split(",").map((part) => Number(part.trim()));
	if (widths.length !== count || widths.some((width) => !Number.isFinite(width) || width <= 0)) return null;
	return widths;
};

/** 합이 100인 정수 비율로 맞춘다. 반올림으로 남는 몫은 마지막 단에 준다. */
export const toPercentWidths = (widths: readonly number[] | null, count: number): number[] => {
	if (count <= 0) return [];
	const source = widths && widths.length === count ? widths : Array.from({ length: count }, () => 1);
	const total = source.reduce((sum, width) => sum + width, 0);
	const rounded = source.map((width) => Math.round((width / total) * 100));
	rounded[count - 1] = 100 - rounded.slice(0, -1).reduce((sum, width) => sum + width, 0);
	return rounded;
};

/** 모든 단이 같은 비율이면 저장하지 않는다(빈 문자열). */
export const formatColumnWidths = (widths: readonly number[]): string =>
	widths.every((width) => width === widths[0]) ? "" : widths.join(",");

/** CSS grid 열 정의. 너비가 없으면 똑같이 나눈다. */
export const columnsGridTemplate = (widths: readonly number[] | null, count: number): string =>
	widths ? widths.map((width) => `minmax(0, ${width}fr)`).join(" ") : `repeat(${count}, minmax(0, 1fr))`;
