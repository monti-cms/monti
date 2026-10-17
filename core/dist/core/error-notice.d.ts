import type { Site } from "../site/index.js";
import type { ErrorCode } from "./error-codes.js";
import { noticeMessages } from "./error-notices.messages.js";
import { errorMessages } from "./errors.messages.js";
import type { ErrorNotice, NoticeRef } from "./store/errors.js";
export { errorMessages, noticeMessages };
/** The text of a code in the admin language: what went wrong and, when the dictionary has it, what to do. */
export declare function codeNotice(site: Pick<Site, "createTranslator">, code: ErrorCode): ErrorNotice;
/** What a person reads for an error in the admin language: its own notice (read from the core notice dictionary when it is a key), else the text of its code. */
export declare function noticeText(site: Pick<Site, "createTranslator">, error: {
    readonly code: ErrorCode;
    readonly notice?: ErrorNotice | NoticeRef;
}): ErrorNotice;
