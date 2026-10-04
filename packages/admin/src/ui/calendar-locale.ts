import { ADMIN_LANGUAGE } from "@monti-cms/core/client";
import type { Locale } from "react-day-picker";
import { enUS, ja, ko, zhCN } from "react-day-picker/locale";

const CALENDAR_LOCALES: Readonly<Record<string, Locale>> = { ko, ja, zh: zhCN };

/** 관리자 화면 언어(`admin.locale`)에 맞는 달력 로캘(요일·월 이름). 없는 언어는 영어다. */
export const adminCalendarLocale: Locale = CALENDAR_LOCALES[ADMIN_LANGUAGE] ?? enUS;
