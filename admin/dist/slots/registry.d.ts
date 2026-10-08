import type { StoredDocument } from "@monti-cms/core/document";
import { type ReactNode } from "react";
import { type SlotRuns } from "./runs.js";
/**
 * Screen slots. Named slots are placed throughout the CMS UI, and the actions attached to a slot are rendered as buttons.
 *
 * - A slot only passes the current context (`getContext`) and the apply function (`apply`). It does not know which actions are attached.
 * - Actions are decided by the sources in `SlotRegistryProvider`. AI features (the definitions on the admin AI screen) are one such source.
 * - An action does not change values itself. It shows results, and `apply` runs only when the user clicks a candidate.
 * - Run state (generating, results) is held by `SlotRegistryProvider`, not by the element that renders the slot. Closing a popover or panel
 *   does not stop the request, and reopening shows the same result. The same slot is distinguished by `scope` (entry, image, etc.).
 */
/**
 * Slot names used by the core. `field` is next to a field, `image` is a body image, `codeRules` is code block rules, `media` is media detail.
 * `translation` is the translation editor (block translation).
 */
export declare const CORE_SLOT_NAMES: readonly ["field", "image", "codeRules", "media", "translation"];
export type CoreSlotName = (typeof CORE_SLOT_NAMES)[number];
/** Slot name. Any string works, and the core uses only `CORE_SLOT_NAMES`. Extensions and sites can place slots with their own names. */
export type SlotName = string;
/** One candidate shown as a result. `value` is the value to apply and `label` is the visible text. */
export interface SlotCandidate {
    value: string;
    label: string;
    /** A short note to append (e.g. the number of places a regex matched). */
    detail?: string;
}
/** An action's result. Multiple candidates, long text, a body fragment (MDX), or a display-only note. */
export type SlotResult = {
    kind: "candidates";
    items: SlotCandidate[];
} | {
    kind: "text";
    text: string;
} | {
    kind: "mdx";
    text: string;
} | {
    kind: "note";
    text: string;
};
/** The current context a slot passes on click. Each slot fills in only the values it knows. */
export interface SlotContext {
    /** Extra request typed when running. Received only when the action is `askInstruction`. */
    request?: string;
    collection?: string;
    locale?: string;
    entryId?: string;
    title?: string;
    summary?: string;
    /** The body of the entry being edited, as a stored document (a plugin that needs text asks a format for it: `useFormat`). */
    body?: StoredDocument;
    /** The target's current value. List values (tag ids, etc.) are arrays. */
    current?: string | readonly string[];
    around?: string;
    code?: string;
    language?: string;
    mediaId?: string;
    /** Site path of an image outside the media library (`/images/...`). */
    imageSrc?: string;
    filename?: string;
}
export type SlotApplyMode = "replace" | "append";
export interface SlotRequest {
    slot: SlotName;
    /** The target within the slot (field name, `alt`, `fold`, etc.). */
    target: string;
    /** The collection of a field slot. */
    collection?: string;
    /** The current context, read on click. */
    getContext: () => SlotContext;
    apply: (value: string, mode: SlotApplyMode) => void;
    disabled?: boolean;
    /** A value that distinguishes multiple slots with the same name and target (entry ID, image URL, etc.). Run state is kept separately per value. */
    scope?: string;
}
export interface SlotAction {
    id: string;
    /** Name shown on the button, menu item and result panel header. */
    label: string;
    /** Icon for the button, menu item and result panel header. Falls back to the default icon when absent. */
    icon?: ReactNode;
    /** Name of the menu button when multiple actions are grouped into one menu. Defaults to the first action's `label`. */
    menuLabel?: string;
    /** Icon of the menu button when multiple actions are grouped into one menu. Defaults to the first action's `icon`. */
    menuIcon?: ReactNode;
    /** How the result is applied. `none` means display only. */
    apply: SlotApplyMode | "none";
    /** Takes an extra request when running. Clicking opens the request input first instead of running immediately. */
    askInstruction?: boolean;
    /** Inserts the result immediately without showing it (the first candidate). Notifies in the result panel when there is nothing to insert. */
    instant?: boolean;
    run: (context: SlotContext, signal: AbortSignal) => Promise<SlotResult>;
}
/** A source that returns the actions to attach to a slot. */
export type SlotSource = (request: Pick<SlotRequest, "slot" | "target" | "collection">) => readonly SlotAction[];
export declare const SlotRegistryContext: import("react").Context<readonly SlotSource[]>;
export declare const SlotRunsContext: import("react").Context<SlotRuns | null>;
export declare function SlotRegistryProvider({ sources, children }: {
    sources: readonly SlotSource[];
    children: ReactNode;
}): import("react").JSX.Element;
