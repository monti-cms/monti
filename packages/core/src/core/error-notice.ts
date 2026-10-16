import type { Site } from "../site";
import type { ErrorCode } from "./error-codes";
import { errorMessages } from "./errors.messages";
import type { ErrorNotice } from "./store/errors";

export { errorMessages };

type ErrorMessageKey = keyof (typeof errorMessages)["messages"]["en"];
// Every code has its text: a code added to the table without one is a compile error here.
const everyCodeHasText: ErrorCode extends ErrorMessageKey ? true : never = true;
void everyCodeHasText;

const hasKey = (key: string): key is ErrorMessageKey => key in errorMessages.messages.en;

/** The text of a code in the admin language: what went wrong and, when the dictionary has it, what to do. */
export function codeNotice(site: Pick<Site, "createTranslator">, code: ErrorCode): ErrorNotice {
	const t = site.createTranslator(errorMessages);
	const fixKey = `${code}.fix`;
	return { what: t(code), ...(hasKey(fixKey) ? { fix: t(fixKey) } : {}) };
}
