import type { Site } from "@monti-cms/core/client";
import type { Locale } from "react-day-picker";
/** Calendar locale (weekday and month names) for the admin UI language (`admin.locale`). Unknown languages fall back to English. */
export declare const adminCalendarLocale: (site: Pick<Site, "ADMIN_LANGUAGE">) => Locale;
