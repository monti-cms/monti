import type { ChartRenderError } from "../chart/types.js";
/** Fixed text that public page blocks show to readers. Chosen to match the site language (`context.locale`). */
export interface BlockLabels {
    readonly calloutNote: string;
    readonly calloutTip: string;
    readonly calloutInfo: string;
    readonly calloutWarning: string;
    readonly calloutDanger: string;
    /** Title of a collapsible block with no title. */
    readonly collapsibleFallback: string;
    readonly chartError: string;
    /** One chart syntax error line (`line 3: …`). The error text is built in this language from the code and values. */
    readonly chartErrorLine: (error: ChartRenderError) => string;
}
/** Text for a language code (`ko`, `ko-KR`, `en`, …). An unknown language gets English. */
export declare function blockLabels(locale?: string): BlockLabels;
