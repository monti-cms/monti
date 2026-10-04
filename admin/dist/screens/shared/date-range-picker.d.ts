/** `YYYY-MM-DD` ↔ calendar date. The admin filter takes dates in the configured time zone and sends them to the server as day boundaries. */
export declare const dayToDate: (value: string) => Date | undefined;
export declare const dateToDay: (date: Date | undefined) => string;
/** Date range calendar. Click the start date then the end date. Clicking one day selects just that day. */
export declare function DateRangeCalendar({ from, to, onChange, }: {
    from: string;
    to: string;
    onChange: (from: string, to: string) => void;
}): import("react").JSX.Element;
/** Filter that opens the date range calendar when the button is pressed (shadcn Date Picker pattern). */
export declare function DateRangePicker({ label, from, to, onChange, }: {
    label: string;
    from: string;
    to: string;
    onChange: (from: string, to: string) => void;
}): import("react").JSX.Element;
