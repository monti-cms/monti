"use client";
import { jsx as _jsx } from "react/jsx-runtime";
import { createContext, useContext, useMemo } from "react";
const NO_EVENTS = {};
/** Joins two event maps: the outer subscribers first, then the inner ones. */
const mergeEvents = (outer, inner) => ({
    editor: {
        imageInserted: [...(outer.editor?.imageInserted ?? []), ...(inner.editor?.imageInserted ?? [])],
    },
});
const AdminEventsContext = createContext(NO_EVENTS);
/** Adds a plugin's `on` to the events of the admin below it. */
export function AdminEventsProvider({ on, children }) {
    const outer = useContext(AdminEventsContext);
    const value = useMemo(() => mergeEvents(outer, on), [outer, on]);
    return _jsx(AdminEventsContext.Provider, { value: value, children: children });
}
/** The subscribers of the admin events, every plugin's joined. */
export const useAdminEvents = () => useContext(AdminEventsContext);
