/**
 * State of the `[[` internal link menu: when it opens, the debounced search of link targets, selection by keyboard,
 * and inserting the chosen target.
 */
import type { Site } from "@monti-cms/core/client";
import type { Editor } from "@tiptap/core";
import { type MutableRefObject } from "react";
import type { TranslatorFor } from "../translator.js";
import { type InternalLinkItem } from "./internal-link.js";
import type { editorMessages } from "./messages.js";
import type { Coords } from "./screen-coords.js";
type LinkState = {
    query: string;
    index: number;
    coords: Coords;
};
export declare function useInternalLinkMenu({ site, t, editorRef, }: {
    site: Site;
    t: TranslatorFor<typeof editorMessages>;
    editorRef: MutableRefObject<Editor | null>;
}): {
    link: LinkState | null;
    linkItems: InternalLinkItem[];
    isLinkLoading: boolean;
    linkError: string | null;
    closeLink: () => void;
    syncLink: (current: Editor, textBefore: string, from: number) => boolean;
    chooseLink: (item: InternalLinkItem) => void;
    handleKey: (event: KeyboardEvent) => boolean | undefined;
};
export {};
