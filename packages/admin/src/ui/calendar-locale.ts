import type { Site } from "@monti-cms/core/site";
import type { Locale } from "react-day-picker";
// One file per language: `react-day-picker/locale` also loads every other date-fns locale.
import { enUS } from "react-day-picker/locale/en-US";
import { ja } from "react-day-picker/locale/ja";
import { ko } from "react-day-picker/locale/ko";
import { zhCN } from "react-day-picker/locale/zh-CN";

const CALENDAR_LOCALES: Readonly<Record<string, Locale>> = { ko, ja, zh: zhCN };

/** Calendar locale (weekday and month names) for the admin UI language (`admin.locale`). Unknown languages fall back to English. */
export const adminCalendarLocale = (site: Pick<Site, "ADMIN_LANGUAGE">): Locale =>
	CALENDAR_LOCALES[site.ADMIN_LANGUAGE] ?? enUS;
