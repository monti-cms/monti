/**
 * Words every screen and plugin page shares: actions, lifecycle verbs and the discard prompt. A screen's own dictionary holds only what is
 * specific to that screen; use this one for the rest (`useTranslator(commonMessages)`).
 *
 * Dictionary files are named `messages.ts` (the main dictionary of a folder) or `<name>.messages.ts` (any other). `src/__test__/messages.test.ts` checks the
 * naming, that English and Korean have the same keys, and that no key is left unreferenced.
 */
export declare const commonMessages: import("@monti-cms/core").MessageBundle<"add" | "addFolder" | "addSubfolder" | "apply" | "cancel" | "close" | "copyFailed" | "delete" | "deleteFailed" | "deleted" | "deleting" | "discard.confirm" | "discard.description" | "discard.title" | "edit" | "lifecycle.archive" | "lifecycle.deletePermanently" | "lifecycle.duplicate" | "lifecycle.publish" | "lifecycle.restore" | "lifecycle.trash" | "lifecycle.unarchive" | "loading" | "move" | "open" | "refresh" | "remove" | "rename" | "reset" | "retry" | "save" | "saveFailed" | "saved" | "saving" | "search" | "untitled" | "upload">;
