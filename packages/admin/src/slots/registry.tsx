"use client";

import type { StoredDocument } from "@monti-cms/core/document";
import { createContext, type ReactNode, useContext, useMemo, useState } from "react";
import { createSlotRuns, type SlotRuns } from "./runs";

/**
 * Screen slots. Named slots are placed throughout the CMS UI, and the actions attached to a slot are rendered as buttons.
 *
 * - A slot only passes the current context (`getContext`) and the apply function (`apply`). It does not know which actions are attached.
 * - Actions are decided by the sources in `SlotRegistryProvider`. AI features (the definitions on the admin AI screen) are one such source.
 * - An action is a job the person pointed at one field: pressing it runs the action and `apply` puts the result in at once, with no result to
 *   accept (⌘Z undoes it). Nothing is made before it is pressed.
 * - Run state (running, failed) is held by `SlotRegistryProvider`, not by the element that renders the slot. Closing a popover or panel
 *   does not stop the request. The same slot is distinguished by `scope` (entry, image, etc.).
 */

/**
 * Slot names used by the core. `field` is next to a field, `image` is a body image, `codeRules` is code block rules, `media` is media detail.
 * `translation` is the translation editor (block translation).
 */
export const CORE_SLOT_NAMES = ["field", "image", "codeRules", "media", "translation"] as const;
export type CoreSlotName = (typeof CORE_SLOT_NAMES)[number];
/** Slot name. Any string works, and the core uses only `CORE_SLOT_NAMES`. Extensions and sites can place slots with their own names. */
export type SlotName = string;

/** One candidate of a result. `value` is the value to apply and `label` is the visible text. */
export interface SlotCandidate {
	value: string;
	label: string;
	/** A short note (e.g. the number of places a regex matched). */
	detail?: string;
}

/**
 * An action's result. Text and candidates are applied: a `replace` action writes the text or the first candidate, an `append` action adds every candidate.
 * A body fragment (MDX) and a note have nothing to apply to a field.
 */
export type SlotResult =
	| { kind: "candidates"; items: SlotCandidate[] }
	| { kind: "text"; text: string }
	| { kind: "mdx"; text: string }
	| { kind: "note"; text: string };

/** The current context a slot passes on click. Each slot fills in only the values it knows. */
export interface SlotContext {
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
	/** Puts a value in. Called once per value the action produced, as soon as the action ends; one that fails (a save) rejects, and the run fails with it. */
	apply: (value: string, mode: SlotApplyMode) => void | Promise<void>;
	/** The target already has a value: the action asks again ("↻ Again") instead of filling. */
	filled?: boolean;
	disabled?: boolean;
	/** A value that distinguishes multiple slots with the same name and target (entry ID, image URL, etc.). Run state is kept separately per value. */
	scope?: string;
}

export interface SlotAction {
	id: string;
	/** Name of the action. A slot with more than one action lists them by this name. */
	label: string;
	/** How the result is applied. */
	apply: SlotApplyMode;
	run: (context: SlotContext, signal: AbortSignal) => Promise<SlotResult>;
}

/** A source that returns the actions to attach to a slot. */
export type SlotSource = (request: Pick<SlotRequest, "slot" | "target" | "collection">) => readonly SlotAction[];

export const SlotRegistryContext = createContext<readonly SlotSource[]>([]);
export const SlotRunsContext = createContext<SlotRuns | null>(null);

export function SlotRegistryProvider({ sources, children }: { sources: readonly SlotSource[]; children: ReactNode }) {
	const parent = useContext(SlotRegistryContext);
	const value = useMemo(() => [...parent, ...sources], [parent, sources]);
	// Run state is held by a single outermost provider (one for the whole admin UI).
	const parentRuns = useContext(SlotRunsContext);
	const [ownRuns] = useState(() => (parentRuns ? null : createSlotRuns()));
	const runs = parentRuns ?? (ownRuns as SlotRuns);
	return (
		<SlotRunsContext.Provider value={runs}>
			<SlotRegistryContext.Provider value={value}>{children}</SlotRegistryContext.Provider>
		</SlotRunsContext.Provider>
	);
}
