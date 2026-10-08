/** The key under which a saved schema leaves its message for the page that opens after the reload. */
export const SAVED_MESSAGE_KEY = "monti.schema.saved";
/** Reloads the page. The dev server runs the new schema by now, and the server-rendered admin (sidebar, forms, lists) is drawn from it. A function of its own so a test can replace it. */
export const reloadPage = () => {
    window.location.reload();
};
/** Leaves `message` for the page that opens after the reload (shown once as a toast). */
export function rememberSaved(message) {
    try {
        window.sessionStorage.setItem(SAVED_MESSAGE_KEY, message);
    }
    catch {
        // Storage can be unavailable (private window, blocked site data): the reload still happens, only the message is lost.
    }
}
/** The message a save left before the reload, once. */
export function takeSavedMessage() {
    try {
        const message = window.sessionStorage.getItem(SAVED_MESSAGE_KEY);
        if (message !== null)
            window.sessionStorage.removeItem(SAVED_MESSAGE_KEY);
        return message;
    }
    catch {
        return null;
    }
}
