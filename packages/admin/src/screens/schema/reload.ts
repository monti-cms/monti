/** The key under which a saved schema leaves its message for the page that opens after the reload. */
export const SAVED_MESSAGE_KEY = "monti.schema.saved";
/** The key of the address the message offers to open ("보기"), when it offers one. */
export const SAVED_HREF_KEY = "monti.schema.saved.href";

/** What a save leaves for the page after the reload: the line of the toast and, when it has one, where its action goes. */
export interface SavedNote {
	readonly message: string;
	readonly href?: string;
}

/** Reloads the page. The dev server runs the new schema by now, and the server-rendered admin (sidebar, forms, lists) is drawn from it. A function of its own so a test can replace it. */
export const reloadPage = (): void => {
	window.location.reload();
};

/** Leaves `message` for the page that opens after the reload (shown once as a toast), with the address its "보기" action opens when `href` is given. */
export function rememberSaved(message: string, href?: string): void {
	try {
		window.sessionStorage.setItem(SAVED_MESSAGE_KEY, message);
		if (href === undefined) window.sessionStorage.removeItem(SAVED_HREF_KEY);
		else window.sessionStorage.setItem(SAVED_HREF_KEY, href);
	} catch {
		// Storage can be unavailable (private window, blocked site data): the reload still happens, only the message is lost.
	}
}

/** What a save left before the reload, once. */
export function takeSavedMessage(): SavedNote | null {
	try {
		const message = window.sessionStorage.getItem(SAVED_MESSAGE_KEY);
		const href = window.sessionStorage.getItem(SAVED_HREF_KEY);
		window.sessionStorage.removeItem(SAVED_MESSAGE_KEY);
		window.sessionStorage.removeItem(SAVED_HREF_KEY);
		return message === null ? null : href === null ? { message } : { message, href };
	} catch {
		return null;
	}
}
