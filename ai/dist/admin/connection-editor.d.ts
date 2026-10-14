import { type AiSettingsView } from "../connection.js";
export declare function useAiSettings(): import("@tanstack/react-query").UseQueryResult<AiSettingsView, Error>;
/**
 * AI screen Connections tab. Keeps several connections (name, mode, URL, key, default model) and lets each action pick which connection to use.
 * The key is stored encrypted by the server, and only the last four characters are shown here.
 * The AI screen holds the open connection (`selected`), because the header's Add connection and tab switching ask about unsaved content.
 */
export declare function ConnectionManager({ selected, onOpen, onSelectedChange, onDirtyChange, }: {
    selected: string | "new" | null;
    /** Opens from the list. If there is unsaved content, the AI screen asks first. */
    onOpen: (id: string | "new") => void;
    /** Switches without asking after save, delete or cancel. */
    onSelectedChange: (id: string | null) => void;
    onDirtyChange: (dirty: boolean) => void;
}): import("react").JSX.Element;
