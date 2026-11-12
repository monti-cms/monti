import { sameJson } from "@monti-cms/core";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useOperation } from "../operations/use-operation";
import { type ProposalItem, type Target, useProposals } from "./use-proposals";

/** A place in a draft: `site.previewPath`, `values.summary`, `fields.summary.label`. A screen flattens what it edits into paths. */
export type Path = string;

/** What one place shows (doc 05): as saved, changed by me (orange dot), filled by ✦ (blue until touched), or proposed by the assistant (blue pencil). */
export type CellState =
	| { kind: "same" }
	| { kind: "mine"; before: unknown }
	| { kind: "quickFilled" }
	| { kind: "proposed"; item: ProposalItem; value: unknown };

export type Change = { path: Path; before: unknown; after: unknown };

type Stored = {
	version: number | string;
	savedAt?: string;
	mine: [Path, unknown][];
	accepted: string[];
	/** Kept because the session ended (`leftSignedOut`): the person did not leave it, so it goes back in by itself. */
	signedOut?: boolean;
};

/** My changes this browser kept from an earlier visit, offered before they go in (`restore: "ask"`). */
export type BrowserCopy = { version: number | string; savedAt: Date | null; mine: [Path, unknown][] };

const storageKey = (target: Target) => `monti.draft.${target.kind}:${target.id}`;

const isMine = (value: unknown): value is [Path, unknown] =>
	Array.isArray(value) && value.length === 2 && typeof value[0] === "string";

export const acceptedAfterRevert = (
	ids: string[],
	items: ProposalItem[],
	proposalValues: (item: ProposalItem) => Record<Path, unknown>,
	path: Path,
	mine: ReadonlyMap<Path, unknown>,
) =>
	ids.filter((id) => {
		const item = items.find((each) => each.id === id);
		if (!item) return true;
		const paths = Object.keys(proposalValues(item));
		return !paths.includes(path) || paths.some((itemPath) => mine.has(itemPath));
	});

export const parseStored = (value: unknown): Stored | null => {
	if (value === null || typeof value !== "object") return null;
	const candidate = value as Record<string, unknown>;
	const { version, savedAt, mine, accepted, signedOut } = candidate;
	if (typeof version !== "number" && typeof version !== "string") return null;
	if (savedAt !== undefined && typeof savedAt !== "string") return null;
	if (!Array.isArray(mine) || !mine.every(isMine)) return null;
	if (!Array.isArray(accepted) || !accepted.every((id): id is string => typeof id === "string")) return null;
	if (signedOut !== undefined && typeof signedOut !== "boolean") return null;
	return {
		version,
		mine,
		accepted,
		...(savedAt === undefined ? {} : { savedAt }),
		...(signedOut === undefined ? {} : { signedOut }),
	};
};

const readStored = (target: Target): Stored | null => {
	try {
		const text = localStorage.getItem(storageKey(target));
		if (!text) return null;
		const stored = parseStored(JSON.parse(text));
		if (!stored) localStorage.removeItem(storageKey(target));
		return stored;
	} catch {
		try {
			localStorage.removeItem(storageKey(target));
		} catch {}
		return null;
	}
};

/**
 * One draft for every screen that edits (doc 05): the server's values, the assistant's pending proposals over them, and my unsaved changes on top.
 * The screen gives its values flattened to paths and says which paths a proposal item writes; the draft counts, reverts, draws and takes. My
 * changes are kept in this browser until saved, so closing the window loses nothing (05-2).
 */
export function useDraft({
	target,
	also,
	base,
	version,
	proposalValues,
	restore = "same-version",
	leftSignedOut = false,
}: {
	target: Target;
	/** The other records this screen shows: their pending proposals join the draft's (settings: the schema and each collection's admin values). */
	also?: Target[];
	/** The saved values, by path; `null` while they load. */
	base: Record<Path, unknown> | null;
	version: number | string | null;
	/** The places a proposal item writes and their new values, as this screen reads the item's input. */
	proposalValues: (item: ProposalItem) => Record<Path, unknown>;
	/**
	 * What happens to changes this browser kept from an earlier visit. `same-version`: they come back by themselves when they were made on the version
	 * the server still has, and are dropped otherwise (a settings screen, 05-2). `ask`: whatever their version, they are offered first (`browserCopy`)
	 * and go in only when the person loads them (the entry editor, doc 02: flows 1·18 and 1·19).
	 */
	restore?: "same-version" | "ask";
	/**
	 * The session ended while these changes were being made (doc 15). The browser's copy is marked, and when the screen opens again after signing in it
	 * goes back in without asking, as long as the server still has the version it was made on; otherwise it is offered as any other.
	 */
	leftSignedOut?: boolean;
}) {
	const proposals = useProposals(target, also);
	const discardOp = useOperation("proposals.discard");
	const [mine, setMineState] = useState<Map<Path, unknown>>(new Map());
	// My changes as they are this instant. A handler may change several places in a row (the undo of one line of the changes list puts back a
	// field's rename and its label): each step starts from what the step before left, not from the map this render captured.
	const mineNow = useRef(mine);
	const setMine = useCallback((next: Map<Path, unknown>) => {
		mineNow.current = next;
		setMineState(next);
	}, []);
	const [quick, setQuick] = useState<Set<Path>>(new Set());
	const [accepted, setAccepted] = useState<string[]>([]);
	const [restoredFor, setRestoredFor] = useState<number | string | null>(null);
	const [offered, setOffered] = useState<Stored | null>(null);
	// `ask` looks at the browser's copy once, when the screen first has the server's values: later versions are the person's own saves.
	const asked = useRef(false);

	useEffect(() => {
		if (version === null || restoredFor === version) return;
		const stored = readStored(target);
		if (restore === "ask") {
			if (!asked.current && stored && stored.mine.length > 0) {
				if (stored.signedOut && stored.version === version) {
					setMine(new Map(stored.mine));
					setAccepted(stored.accepted);
				} else setOffered(stored);
			}
			asked.current = true;
		} else if (stored && stored.version === version) {
			// The browser's copy of my changes comes back when it was made on the version the server still has.
			setMine(new Map(stored.mine));
			setAccepted(stored.accepted);
		}
		setRestoredFor(version);
	}, [target, version, restoredFor, restore, setMine]);

	useEffect(() => {
		// While a kept copy waits for an answer, it stays as it is: what is typed meanwhile is not kept over it.
		if (version === null || restoredFor !== version || offered) return;
		try {
			if (mine.size === 0) localStorage.removeItem(storageKey(target));
			else
				localStorage.setItem(
					storageKey(target),
					JSON.stringify({
						version,
						savedAt: new Date().toISOString(),
						mine: [...mine],
						accepted,
						...(leftSignedOut ? { signedOut: true } : {}),
					} satisfies Stored),
				);
		} catch {}
	}, [target, version, mine, accepted, restoredFor, offered, leftSignedOut]);

	/** The pending items not yet taken, with the places they write. */
	const pending = useMemo(
		() =>
			proposals.items
				.filter((item) => !accepted.includes(item.id))
				.map((item) => ({ item, values: proposalValues(item) })),
		[proposals.items, accepted, proposalValues],
	);

	const saved = useCallback((path: Path) => base?.[path], [base]);
	const value = useCallback((path: Path) => (mine.has(path) ? mine.get(path) : saved(path)), [mine, saved]);

	const cell = useCallback(
		(path: Path): CellState => {
			if (quick.has(path)) return { kind: "quickFilled" };
			if (mine.has(path)) return { kind: "mine", before: saved(path) };
			// A proposal is drawn against the value the screen shows, not the saved one (doc 05, agent).
			const proposed = pending.find(({ values }) => path in values && !sameJson(values[path], value(path)));
			return proposed ? { kind: "proposed", item: proposed.item, value: proposed.values[path] } : { kind: "same" };
		},
		[quick, mine, pending, saved, value],
	);

	const put = useCallback(
		(path: Path, next: unknown) => {
			const copy = new Map(mineNow.current);
			if (sameJson(next, saved(path))) copy.delete(path);
			else copy.set(path, next);
			setMine(copy);
		},
		[saved, setMine],
	);

	const take = useCallback(
		(item: ProposalItem) => {
			for (const [path, next] of Object.entries(proposalValues(item))) put(path, next);
			setAccepted((current) => (current.includes(item.id) ? current : [...current, item.id]));
		},
		[proposalValues, put],
	);

	/** I change a place. Changing a proposed place takes the proposal first, then my change goes over it (proposal.md). */
	const set = useCallback(
		(path: Path, next: unknown) => {
			const state = cell(path);
			if (state.kind === "proposed") take(state.item);
			setQuick((current) => {
				if (!current.has(path)) return current;
				const copy = new Set(current);
				copy.delete(path);
				return copy;
			});
			put(path, next);
		},
		[cell, take, put],
	);

	/** The ✦ fill button: the value goes straight in, blue until a person touches the place or it is saved. */
	const quickFill = useCallback(
		(path: Path, next: unknown) => {
			put(path, next);
			setQuick((current) => new Set(current).add(path));
		},
		[put],
	);

	const revert = useCallback(
		(path: Path) => {
			const nextMine = new Map(mineNow.current);
			nextMine.delete(path);
			setMine(nextMine);
			setAccepted((ids) => acceptedAfterRevert(ids, proposals.items, proposalValues, path, nextMine));
			setQuick((current) => {
				const copy = new Set(current);
				copy.delete(path);
				return copy;
			});
		},
		[setMine, proposals.items, proposalValues],
	);

	const revertAll = useCallback(() => {
		setMine(new Map());
		setQuick(new Set());
		setAccepted([]);
	}, [setMine]);

	const accept = useCallback(
		(id: string) => {
			const item = proposals.items.find((each) => each.id === id);
			if (item) take(item);
		},
		[proposals.items, take],
	);

	const discard = useCallback(
		async (ids: string[]) => {
			if (ids.length === 0) return;
			if ((await discardOp.run({ ids })).ok) await proposals.reload();
		},
		[discardOp, proposals],
	);

	const changes: Change[] = useMemo(
		() => [...mine].map(([path, after]) => ({ path, before: saved(path), after })),
		[mine, saved],
	);

	return {
		value,
		cell,
		set,
		quickFill,
		revert,
		revertAll,
		changes,
		dirty: mine.size > 0,
		/** The pending proposals in order, each with the places it writes: the bubble walks them. */
		proposals: pending,
		accept,
		acceptAll: () => {
			for (const { item } of pending) take(item);
		},
		discard: (id: string) => discard([id]),
		discardAll: () => discard(pending.map(({ item }) => item.id)),
		/**
		 * Counts an item as taken whose change the screen put in itself (the body editor applies a body proposal's block operations to its own text).
		 * The save sends it with the others.
		 */
		markTaken: (id: string) => setAccepted((current) => (current.includes(id) ? current : [...current, id])),
		/** The items taken into this draft: the save sends them (`accepted`), and the server marks them applied with it. */
		accepted,
		/** Changes this browser kept from an earlier visit, waiting to be loaded or dropped (`restore: "ask"`). */
		browserCopy: offered
			? ({
					version: offered.version,
					savedAt: offered.savedAt ? new Date(offered.savedAt) : null,
					mine: offered.mine,
				} satisfies BrowserCopy)
			: null,
		/** The kept changes go in over what the server has now. */
		loadBrowserCopy: () => {
			if (!offered) return;
			setMine(new Map(offered.mine));
			setAccepted(offered.accepted);
			setOffered(null);
		},
		/** The kept changes are thrown away. */
		dropBrowserCopy: () => {
			try {
				localStorage.removeItem(storageKey(target));
			} catch {}
			setOffered(null);
		},
		/** After the save went through: the server's values are the new base, so my changes are gone. */
		saved: () => {
			setMine(new Map());
			setQuick(new Set());
			setAccepted([]);
			void proposals.reload();
		},
		/**
		 * After a save that went through in part (settings: the admin values saved, the schema file not written): given the values the server has
		 * now, my changes that are saved leave the draft and the rest stay to be saved again.
		 */
		savedPart: (now: Record<Path, unknown>) => {
			setMine(new Map([...mineNow.current].filter(([path, value]) => !sameJson(value, now[path]))));
			// The items taken into the draft went with the save: the server has marked them applied.
			setAccepted([]);
			void proposals.reload();
		},
	};
}
