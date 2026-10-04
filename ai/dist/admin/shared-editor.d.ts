import type { AiSharedView } from "../shared.js";
export declare const AI_SHARED_KEY: readonly ["cms", "ai", "shared"];
/** Shape of the instruction and shared text input fields (both are text that goes into instructions). */
export declare const PROMPT_ROWS = 8;
export declare const PROMPT_TEXTAREA = "min-h-40 text-xs md:text-xs";
export declare function useAiShared(): import("@tanstack/react-query").UseQueryResult<AiSharedView, Error>;
/**
 * AI screen Shared texts tab. The list and edit pane of texts (e.g. a style guide) that go into the instructions of several actions as `{{shared.key}}`.
 * For a text written in the config, only the content is edited; for a text added by the admin, the name and content are edited or it is deleted. A saved text is used right away by
 * every action run afterwards. The AI screen holds the open text (`selected`), because the header's Add text and tab switching ask about
 * unsaved content.
 */
export declare function SharedManager({ selected, onOpen, onSelectedChange, onDirtyChange, }: {
    selected: string | "new" | null;
    /** Opens from the list. If there is unsaved content, the AI screen asks first. */
    onOpen: (key: string | "new") => void;
    /** Switches without asking after save, delete or cancel. */
    onSelectedChange: (key: string | null) => void;
    onDirtyChange: (dirty: boolean) => void;
}): import("react").JSX.Element;
