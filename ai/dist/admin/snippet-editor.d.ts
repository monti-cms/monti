import type { AiSnippetView } from "../snippets.js";
/** Shape of the instruction and prompt snippet input fields (both are text that goes into instructions). */
export declare const PROMPT_ROWS = 8;
export declare const PROMPT_TEXTAREA = "min-h-40 text-xs md:text-xs";
export declare function useAiSnippets(): import("@tanstack/react-query").UseQueryResult<AiSnippetView, Error>;
/**
 * AI screen Prompt snippets tab. The list and edit pane of texts (e.g. a style guide) that go into the instructions of several actions as `{{snippet.key}}`.
 * For a text written in the config, only the content is edited; for a text added by the admin, the name and content are edited or it is deleted. A saved text is used right away by
 * every action run afterwards. The AI screen holds the open text (`selected`), because the header's Add text and tab switching ask about
 * unsaved content.
 */
export declare function SnippetManager({ selected, onOpen, onSelectedChange, onDirtyChange, }: {
    selected: string | "new" | null;
    /** Opens from the list. If there is unsaved content, the AI screen asks first. */
    onOpen: (key: string | "new") => void;
    /** Switches without asking after save, delete or cancel. */
    onSelectedChange: (key: string | null) => void;
    onDirtyChange: (dirty: boolean) => void;
}): import("react").JSX.Element;
