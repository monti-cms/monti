/**
 * Cmd/Ctrl+S runs `onSave` instead of the browser's "save page". The latest `onSave` is always used, so it can close over current state.
 * Ignored while an IME composition is going on.
 */
export declare function useSaveShortcut(onSave: () => void, enabled?: boolean): void;
