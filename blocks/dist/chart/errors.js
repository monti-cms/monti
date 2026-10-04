import { translate } from "@monti-cms/core";
import { chartMessages } from "./messages.js";
/** Human-readable text of one chart syntax error (`line 3: …`). The parser only gives a code and values; the text is built in the caller's language. */
export const chartErrorLine = (error, text) => text("error.line", { line: error.line, message: text(`error.${error.code}`, error.values) });
/**
 * Builds only the error description (without the line number) in the content language (`ko`, `ko-KR`, `en`, …). Used when a site has its own line-number wording. Unknown languages fall back to English.
 */
export const chartErrorMessage = (error, locale) => translate(chartMessages, (locale ?? "").toLowerCase().split(/[-_]/)[0] ?? "", `error.${error.code}`, error.values);
