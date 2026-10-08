import { enUS, ja, ko, zhCN } from "react-day-picker/locale";
const CALENDAR_LOCALES = { ko, ja, zh: zhCN };
/** Calendar locale (weekday and month names) for the admin UI language (`admin.locale`). Unknown languages fall back to English. */
export const adminCalendarLocale = (site) => CALENDAR_LOCALES[site.ADMIN_LANGUAGE] ?? enUS;
