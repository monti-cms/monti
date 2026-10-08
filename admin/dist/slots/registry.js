"use client";
import { jsx as _jsx } from "react/jsx-runtime";
import { createContext, useContext, useMemo, useState } from "react";
import { createSlotRuns } from "./runs.js";
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
export const CORE_SLOT_NAMES = ["field", "image", "codeRules", "media", "translation"];
export const SlotRegistryContext = createContext([]);
export const SlotRunsContext = createContext(null);
export function SlotRegistryProvider({ sources, children }) {
    const parent = useContext(SlotRegistryContext);
    const value = useMemo(() => [...parent, ...sources], [parent, sources]);
    // Run state is held by a single outermost provider (one for the whole admin UI).
    const parentRuns = useContext(SlotRunsContext);
    const [ownRuns] = useState(() => (parentRuns ? null : createSlotRuns()));
    const runs = parentRuns ?? ownRuns;
    return (_jsx(SlotRunsContext.Provider, { value: runs, children: _jsx(SlotRegistryContext.Provider, { value: value, children: children }) }));
}
