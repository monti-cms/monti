import { noticeMessages } from "./error-notices.messages.js";
import { errorMessages } from "./errors.messages.js";
export { errorMessages, noticeMessages };
// Every code has its text: a code added to the table without one is a compile error here.
const everyCodeHasText = true;
void everyCodeHasText;
const hasKey = (key) => key in errorMessages.messages.en;
const hasNoticeKey = (key) => key in noticeMessages.messages.en;
/** The text of a code in the admin language: what went wrong and, when the dictionary has it, what to do. */
export function codeNotice(site, code) {
    const t = site.createTranslator(errorMessages);
    const fixKey = `${code}.fix`;
    return { what: t(code), ...(hasKey(fixKey) ? { fix: t(fixKey) } : {}) };
}
/** What a person reads for an error in the admin language: its own notice (read from the core notice dictionary when it is a key), else the text of its code. */
export function noticeText(site, error) {
    const notice = error.notice;
    if (!notice)
        return codeNotice(site, error.code);
    if (!("key" in notice))
        return notice;
    const t = site.createTranslator(noticeMessages);
    const fixKey = `${notice.key}.fix`;
    return { what: t(notice.key, notice.vars), ...(hasNoticeKey(fixKey) ? { fix: t(fixKey, notice.vars) } : {}) };
}
