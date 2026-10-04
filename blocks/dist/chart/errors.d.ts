import { type MessageVars } from "@monti-cms/core";
import { chartMessages } from "./messages.js";
import type { ChartDslParseError } from "./types.js";
export type ChartMessageKey = keyof (typeof chartMessages)["messages"]["en"];
/** Function that picks a message from the chart message dictionary (made by whichever is in use: admin-language `createTranslator` or content-language `translate`). */
export type ChartText = (key: ChartMessageKey, vars?: MessageVars) => string;
/** Human-readable text of one chart syntax error (`line 3: …`). The parser only gives a code and values; the text is built in the caller's language. */
export declare const chartErrorLine: (error: ChartDslParseError, text: ChartText) => string;
/**
 * Builds only the error description (without the line number) in the content language (`ko`, `ko-KR`, `en`, …). Used when a site has its own line-number wording. Unknown languages fall back to English.
 */
export declare const chartErrorMessage: (error: ChartDslParseError, locale?: string) => string;
