/** The key under which a saved schema leaves its message for the page that opens after the reload. */
export declare const SAVED_MESSAGE_KEY = "monti.schema.saved";
/** Reloads the page. The dev server runs the new schema by now, and the server-rendered admin (sidebar, forms, lists) is drawn from it. A function of its own so a test can replace it. */
export declare const reloadPage: () => void;
/** Leaves `message` for the page that opens after the reload (shown once as a toast). */
export declare function rememberSaved(message: string): void;
/** The message a save left before the reload, once. */
export declare function takeSavedMessage(): string | null;
