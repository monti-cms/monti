import type { Site } from "@monti-cms/core/client";
/** Date/time display of the admin screen. Notation follows the admin screen language (`admin.locale`), time zone follows the site setting (`timeZone`). */
export declare const formatDateTime: (site: Site, value: string | number | Date, options?: Intl.DateTimeFormatOptions) => string;
/** Date only (`2025. 8. 7.`). */
export declare const formatDateOnly: (site: Site, value: string | number | Date) => string;
/** Year in the configured time zone. */
export declare const zonedYear: (site: Site, value: string | number | Date) => number;
