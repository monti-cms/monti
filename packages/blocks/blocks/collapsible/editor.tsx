"use client";

/**
 * The collapsible block's view in the admin's editor (doc 18, "블록 폴더와 꽂는 곳"): the admin draws the block with this. Until its tool row and
 * settings are built (after the owner's screen approval) it is the site's drawing, as the core draws a block with no editor view of its own.
 */
export { Collapsible as CollapsibleEditor } from "./site";
