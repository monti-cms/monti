"use client";
import { jsx as _jsx } from "react/jsx-runtime";
import { createContext, useContext } from "react";
const BlockIssuesContext = createContext(null);
const NONE = [];
/**
 * Gives the block views below it the warnings to show next to their block (a block's own syntax check, for one). The entry editor provides it from the
 * warnings of the latest save or publish; without it, no block shows any.
 */
export function BlockIssuesProvider({ issues, children }) {
    return _jsx(BlockIssuesContext.Provider, { value: issues, children: children });
}
/** The texts of the warnings of the block with this id. */
export function useBlockIssues(blockId) {
    const issues = useContext(BlockIssuesContext);
    return (blockId !== null && issues?.get(blockId)) || NONE;
}
