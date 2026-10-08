import type { ConflictInfo, RecoveryOffer } from "./entry-editor-store.js";
/**
 * Asks whether to load a browser temporary copy that is not on the server (`useEntryEditor().recovery`). It is a `conflict` offer if the server has
 * changed since the copy was made. Closing the dialog only hides it; the copy is kept until the user answers.
 */
export declare function RecoveryDialog({ recovery, onClose, onKeepServer, onRestore, }: {
    recovery: RecoveryOffer | null;
    onClose: () => void;
    onKeepServer: () => void;
    onRestore: () => void;
}): import("react").JSX.Element;
/**
 * When someone saved elsewhere first during a save or publish (`useEntryEditor().conflict`). Compare both sides, then copy or pick one.
 * Neither answer reloads the page: the editor loads the server version, or saves on top of it.
 */
export declare function ConflictDialog({ conflict, onClose, onReload, onOverwrite, }: {
    conflict: ConflictInfo | null;
    onClose: () => void;
    /** Loads the latest server version in place of my input. */
    onReload: () => void;
    /** Overwrites the latest server version with my input. */
    onOverwrite: () => void;
}): import("react").JSX.Element;
