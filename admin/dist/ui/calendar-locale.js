import { ADMIN_LANGUAGE } from "@monti-cms/core/client";
import { enUS, ja, ko, zhCN } from "react-day-picker/locale";
const CALENDAR_LOCALES = { ko, ja, zh: zhCN };
/** Calendar locale (weekday and month names) for the admin UI language (`admin.locale`). Unknown languages fall back to English. */
export const adminCalendarLocale = CALENDAR_LOCALES[ADMIN_LANGUAGE] ?? enUS;
