/**
 * What a form picks for the API key of one place (an AI connection, the spell checker, git sync). `saved` uses a key of the store, `new` saves the value as a
 * new key in the store (named after the place) and uses that, `none` uses no key. Sent to the plugin's route as it is; the route resolves it on the server.
 */
export type ApiKeyChoice = {
    readonly use: "saved";
    readonly keyId: string;
} | {
    readonly use: "new";
    readonly value: string;
} | {
    readonly use: "none";
};
/** The value that goes to the server. A new key with nothing typed is no key yet. */
export declare const choiceReady: (choice: ApiKeyChoice) => boolean;
/**
 * The API key field of a form: "use a saved key" (a list of the store's keys) or "enter a new key" (saved into the store). The key a place uses now is
 * `current`; `baseName` is the name a new key gets (the service or the place). No value ever comes back from the server: a saved key shows its name and last four characters.
 */
export declare function ApiKeyField({ value, onChange, baseName, label, disabled, className, }: {
    value: ApiKeyChoice;
    onChange: (choice: ApiKeyChoice) => void;
    baseName: string;
    /** Label of the whole field. Default: "API key". */
    label?: string;
    disabled?: boolean;
    className?: string;
}): import("react").JSX.Element;
