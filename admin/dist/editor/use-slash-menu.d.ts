/**
 * State of the `/` slash menu: when it opens (start of an empty paragraph), the commands it offers (defaults plus plugin and
 * text-style extension actions) and its keyboard handling.
 */
import type { Site } from "@monti-cms/core/site";
import type { Editor, Range } from "@tiptap/core";
import { type MutableRefObject } from "react";
import type { EditorInsertAction } from "../admin-components.js";
import type { EditorAllowance } from "./allowed.js";
import type { useMarkExtensions } from "./inline-bubble.js";
import type { Coords } from "./screen-coords.js";
import { type SlashCommandItem } from "./slash-command.js";
type SlashState = {
    query: string;
    index: number;
    coords: Coords;
};
export declare function useSlashMenu({ site, allowance, insertActions, markExtensions, editorRef, }: {
    site: Site;
    allowance: EditorAllowance;
    insertActions: readonly EditorInsertAction[] | undefined;
    /** Text-style extensions allowed in the body; their insert actions follow the default text format items. */
    markExtensions: ReturnType<typeof useMarkExtensions>;
    editorRef: MutableRefObject<Editor | null>;
}): {
    slash: SlashState | null;
    slashRangeRef: import("react").RefObject<Range | null>;
    extraCommands: SlashCommandItem[];
    inlineCommands: SlashCommandItem[];
    closeSlash: () => void;
    syncSlash: (current: Editor, textBefore: string, from: number) => void;
    handleKey: (event: KeyboardEvent) => boolean | undefined;
};
export {};
