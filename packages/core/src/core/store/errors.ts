import type { MessageVars } from "../../i18n/define";
import { brandErrorClass } from "../error-brand";
import type { ErrorCode } from "../error-codes";
import type { noticeMessages } from "../error-notices.messages";

/**
 * What a person is told about an error, already in the admin language: what went wrong and, when there is one, what to do about it.
 * Raw text from a library, a parser or another service never goes here; it stays in the error's `message`, which the answer sends as `detail`.
 */
export interface ErrorNotice {
	/** What went wrong, in one plain sentence. */
	readonly what: string;
	/** What to do about it. */
	readonly fix?: string;
}

/** A key of the core notice dictionary (`cms.core.notices`), not a `.fix` key: the `.fix` text, when there is one, comes along. */
export type NoticeKey = Exclude<keyof (typeof noticeMessages)["messages"]["en"], `${string}.fix`>;

/**
 * A notice core code throws where no site is at hand: a key of the core notice dictionary and the values of its `{name}` placeholders.
 * The answer reads it in the admin language.
 */
export interface NoticeRef {
	readonly key: NoticeKey;
	readonly vars?: MessageVars;
}

export interface CmsErrorOptions {
	/** The version the server holds, for a `conflict`: the caller can reload and retry. It reaches the response as `details.serverVersion`. */
	readonly serverVersion?: number;
	/** Machine-readable extra data (the places a key is used, say). */
	readonly details?: unknown;
	/** Problems found in the request (the issues of a validation), when the code is about the content. */
	readonly issues?: readonly unknown[];
	/**
	 * The text for a person, when the thrower knows more than the code says: text already in the admin language, or a key of the core notice dictionary.
	 * Without it the answer uses the text of the code.
	 */
	readonly notice?: ErrorNotice | NoticeRef;
	readonly cause?: unknown;
}

/**
 * The one error the server code throws for a request it cannot do. `code` is an {@link ErrorCode}, so the HTTP status comes from one table and
 * the response has one shape: `{ error: { code, message, fix?, detail?, issues?, details? } }`.
 *
 * `message` is for developers and the server log (English, may name ids and values). The person reads the `notice`, or the text of the code when there is none.
 */
export class CmsError extends Error {
	public readonly code: ErrorCode;
	public readonly serverVersion?: number;
	public readonly details?: unknown;
	public readonly issues?: readonly unknown[];
	public readonly notice?: ErrorNotice | NoticeRef;

	constructor(message: string, code: ErrorCode, options: CmsErrorOptions = {}) {
		super(message, options.cause === undefined ? undefined : { cause: options.cause });
		this.code = code;
		this.serverVersion = options.serverVersion;
		this.details = options.details;
		this.issues = options.issues;
		this.notice = options.notice;
		this.name = "CmsError";
	}
}
brandErrorClass(CmsError, "CmsError");
