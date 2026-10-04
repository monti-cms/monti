import { type ReactNode } from "react";
import { type AiSettingsView } from "../connection.js";
export declare const AI_SETTINGS_KEY: readonly ["cms", "ai", "settings"];
export declare function useAiSettings(): import("@tanstack/react-query").UseQueryResult<AiSettingsView, Error>;
/** Pieces shared by the three tabs of the AI screen. The open-item shape of the list is the same as the admin screen's `OPEN_ITEM`. */
export declare const OPEN_ITEM = "bg-cms-accent text-cms-accent-foreground";
/** Frame of the detail pane (shared by actions, connections and shared texts). */
export declare const DETAIL_PANE = "mx-auto flex w-full max-w-3xl flex-col gap-5 p-6 text-sm";
/** Load failure. Reports it in place and allows fetching again. */
export declare function LoadError({ message, onRetry }: {
    message: string;
    onRetry: () => void;
}): import("react").JSX.Element;
/** One list row. Status text to the right of the name, and a dim description below. */
export declare function ListRow({ title, status, detail, current, onClick, }: {
    title: string;
    status?: string | null;
    detail: ReactNode;
    current: boolean;
    onClick: () => void;
}): import("react").JSX.Element;
/** Placeholder while the list loads. */
export declare function ListSkeleton({ rows }: {
    rows: number;
}): import("react").JSX.Element[];
/** One error line (inside the edit pane). */
export declare function InlineError({ children }: {
    children: ReactNode;
}): import("react").JSX.Element;
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
