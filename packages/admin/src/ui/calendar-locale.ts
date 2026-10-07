import type { Site } from "@monti-cms/core/client";
import type { Locale } from "react-day-picker";
import { enUS, ja, ko, zhCN } from "react-day-picker/locale";

const CALENDAR_LOCALES: Readonly<Record<string, Locale>> = { ko, ja, zh: zhCN };

/** Calendar locale (weekday and month names) for the admin UI language (`admin.locale`). Unknown languages fall back to English. */
export const adminCalendarLocale = (site: Pick<Site, "ADMIN_LANGUAGE">): Locale =>
	CALENDAR_LOCALES[site.ADMIN_LANGUAGE] ?? enUS;
