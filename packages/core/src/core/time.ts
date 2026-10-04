import { cmsConfig } from "../config/resolved";

/**
 * 날짜·시각 입력(`datetime-local`)의 시간대 규칙. 사이트 설정의 `timeZone` 벽시계로 입력하고 UTC 순간으로 저장한다.
 */

export const CMS_TIME_ZONE = cmsConfig.timeZone ?? "UTC";

/**
 * 관리자 화면의 날짜·숫자 표기 언어(BCP 47). 사이트 설정의 `admin.locale`, 없으면 사이트 기본 언어(화면 글과 같다, M15).
 */
export const ADMIN_LOCALE = cmsConfig.admin?.locale ?? cmsConfig.defaultLocale;

type Parts = { year: number; month: number; day: number; hour: number; minute: number };

function zonedParts(date: Date, timeZone: string): Parts {
	const parts = new Intl.DateTimeFormat("en-CA", {
		timeZone,
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
		hourCycle: "h23",
	}).formatToParts(date);
	const part = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((item) => item.type === type)?.value ?? 0);
	return { year: part("year"), month: part("month"), day: part("day"), hour: part("hour"), minute: part("minute") };
}

const pad = (value: number, length = 2) => String(value).padStart(length, "0");

/** UTC 순간을 그 시간대의 `datetime-local` 문자열(`YYYY-MM-DDTHH:mm`)로 바꾼다. */
export function formatDateTimeInput(
	value: string | number | Date | null | undefined,
	timeZone: string = CMS_TIME_ZONE,
): string {
	if (value === null || value === undefined || value === "") return "";
	const date = value instanceof Date ? value : new Date(value);
	if (Number.isNaN(date.getTime())) return "";
	const { year, month, day, hour, minute } = zonedParts(date, timeZone);
	return `${pad(year, 4)}-${pad(month)}-${pad(day)}T${pad(hour)}:${pad(minute)}`;
}

/** 그 시간대에서 이 순간의 UTC와의 차이(분). */
function offsetMinutes(instant: number, timeZone: string): number {
	const { year, month, day, hour, minute } = zonedParts(new Date(instant), timeZone);
	const asUtc = Date.UTC(year, month - 1, day, hour, minute);
	return Math.round((asUtc - Math.floor(instant / 60_000) * 60_000) / 60_000);
}

/**
 * 그 시간대의 벽시계 입력을 UTC ISO 순간으로 바꾼다. 없는 날짜(2월 30일 등)나 그 시간대에 없는 시각(서머타임으로
 * 건너뛴 시각)은 `null`이다.
 */
export function parseDateTimeInput(value: string, timeZone: string = CMS_TIME_ZONE): string | null {
	const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
	if (!match) return null;
	const [year, month, day, hour, minute] = match.slice(1).map(Number) as [number, number, number, number, number];
	const wall = new Date(0);
	wall.setUTCFullYear(year, month - 1, day);
	wall.setUTCHours(hour, minute, 0, 0);
	if (
		wall.getUTCFullYear() !== year ||
		wall.getUTCMonth() !== month - 1 ||
		wall.getUTCDate() !== day ||
		wall.getUTCHours() !== hour ||
		wall.getUTCMinutes() !== minute
	) {
		return null;
	}
	// 벽시계를 UTC로 본 값에서 그 시간대의 차이를 빼고, 서머타임 경계면 한 번 더 맞춘다.
	let instant = wall.getTime() - offsetMinutes(wall.getTime(), timeZone) * 60_000;
	instant = wall.getTime() - offsetMinutes(instant, timeZone) * 60_000;
	return formatDateTimeInput(instant, timeZone) === value ? new Date(instant).toISOString() : null;
}
