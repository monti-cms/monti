import type { Site } from "../site";
import type { ErrorCode } from "./error-codes";
import { noticeMessages } from "./error-notices.messages";
import { errorMessages } from "./errors.messages";
import type { ErrorNotice, NoticeRef } from "./store/errors";

export { errorMessages, noticeMessages };

type ErrorMessageKey = keyof (typeof errorMessages)["messages"]["en"];
// Every code has its text: a code added to the table without one is a compile error here.
const everyCodeHasText: ErrorCode extends ErrorMessageKey ? true : never = true;
void everyCodeHasText;

const hasKey = (key: string): key is ErrorMessageKey => key in errorMessages.messages.en;

type NoticeMessageKey = keyof (typeof noticeMessages)["messages"]["en"];
const hasNoticeKey = (key: string): key is NoticeMessageKey => key in noticeMessages.messages.en;

/** The text of a code in the admin language: what went wrong and, when the dictionary has it, what to do. */
export function codeNotice(site: Pick<Site, "createTranslator">, code: ErrorCode): ErrorNotice {
	const t = site.createTranslator(errorMessages);
	const fixKey = `${code}.fix`;
	return { what: t(code), ...(hasKey(fixKey) ? { fix: t(fixKey) } : {}) };
}

/** What a person reads for an error in the admin language: its own notice (read from the core notice dictionary when it is a key), else the text of its code. */
export function noticeText(
	site: Pick<Site, "createTranslator">,
	error: { readonly code: ErrorCode; readonly notice?: ErrorNotice | NoticeRef },
): ErrorNotice {
	const notice = error.notice;
	if (!notice) return codeNotice(site, error.code);
	if (!("key" in notice)) return notice;
	const t = site.createTranslator(noticeMessages);
	const fixKey = `${notice.key}.fix`;
	return { what: t(notice.key, notice.vars), ...(hasNoticeKey(fixKey) ? { fix: t(fixKey, notice.vars) } : {}) };
}
