import { sameJson } from "@monti-cms/core";
import { useCallback, useEffect, useMemo, useState } from "react";
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

type Stored = { version: number | string; mine: [Path, unknown][]; accepted: string[] };

const storageKey = (target: Target) => `monti.draft.${target.kind}:${target.id}`;

const readStored = (target: Target): Stored | null => {
	try {
		const text = localStorage.getItem(storageKey(target));
		return text ? (JSON.parse(text) as Stored) : null;
	} catch {
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
	base,
	version,
	proposalValues,
}: {
	target: Target;
	/** The saved values, by path; `null` while they load. */
	base: Record<Path, unknown> | null;
	version: number | string | null;
	/** The places a proposal item writes and their new values, as this screen reads the item's input. */
	proposalValues: (item: ProposalItem) => Record<Path, unknown>;
}) {
	const proposals = useProposals(target);
	const discardOp = useOperation("proposals.discard");
	const [mine, setMine] = useState<Map<Path, unknown>>(new Map());
	const [quick, setQuick] = useState<Set<Path>>(new Set());
	const [accepted, setAccepted] = useState<string[]>([]);
	const [restoredFor, setRestoredFor] = useState<number | string | null>(null);

	// The browser's copy of my changes comes back when it was made on the version the server still has.
	useEffect(() => {
		if (version === null || restoredFor === version) return;
		const stored = readStored(target);
		if (stored && stored.version === version) {
			setMine(new Map(stored.mine));
			setAccepted(stored.accepted);
		}
		setRestoredFor(version);
	}, [target, version, restoredFor]);

	useEffect(() => {
		if (version === null || restoredFor !== version) return;
		try {
			if (mine.size === 0) localStorage.removeItem(storageKey(target));
			else
				localStorage.setItem(
					storageKey(target),
					JSON.stringify({ version, mine: [...mine], accepted } satisfies Stored),
				);
		} catch {}
	}, [target, version, mine, accepted, restoredFor]);

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
		(path: Path, next: unknown) =>
			setMine((current) => {
				const copy = new Map(current);
				if (sameJson(next, saved(path))) copy.delete(path);
				else copy.set(path, next);
				return copy;
			}),
		[saved],
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

	const revert = useCallback((path: Path) => {
		setMine((current) => {
			const copy = new Map(current);
			copy.delete(path);
			return copy;
		});
		setQuick((current) => {
			const copy = new Set(current);
			copy.delete(path);
			return copy;
		});
	}, []);

	const revertAll = useCallback(() => {
		setMine(new Map());
		setQuick(new Set());
		setAccepted([]);
	}, []);

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
		/** The items taken into this draft: the save sends them (`accepted`), and the server marks them applied with it. */
		accepted,
		/** After the save went through: the server's values are the new base, so my changes are gone. */
		saved: () => {
			setMine(new Map());
			setQuick(new Set());
			setAccepted([]);
			void proposals.reload();
		},
	};
}
