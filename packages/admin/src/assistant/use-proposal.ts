import type { ApplyEvent, ProposalItemView, ProposalView } from "@monti-cms/core";
import { toast } from "@monti-cms/ui";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAdmin } from "../operations/admin-context";
import { useOperation, useRead } from "../operations/use-operation";
import { useAssistant } from "./use-assistant";

/** How often a proposal that is being applied somewhere else (another tab, an apply whose listener went away) is read again. */
const POLL_MS = 2000;

/**
 * One proposal as its card and its review page hold it: what it would change, and the three things a person does with all of it (apply what is
 * kept in, discard, undo). Both read the same proposal, so a check taken out on the review page is counted out on the card. Applying is a
 * stream: each item's result comes as it lands.
 */
export function useProposal(id: string) {
	const { streams, t, wrote } = useAdmin();
	const { proposalTick, touchProposals } = useAssistant();
	const read = useRead<ProposalView>("proposals.get", { id });
	const reload = read.reload;
	const discarding = useOperation("proposals.discard");
	const reverting = useOperation<{ reverted: string[]; kept: string[] }>("proposals.revert");
	const including = useOperation("proposals.include");
	/** How far an apply this page started has come. */
	const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
	/** The item the assistant is making again on its record as it is now. */
	const [remaking, setRemaking] = useState<string | null>(null);
	const view = read.data;

	// The run adds to it, another place changes it: it is read again.
	const first = useRef(true);
	// biome-ignore lint/correctness/useExhaustiveDependencies: it follows the tick
	useEffect(() => {
		if (first.current) first.current = false;
		else void reload();
	}, [proposalTick]);

	// An apply that goes on without this page listening is read until it is over.
	const applyingElsewhere = view?.applying === true && progress === null;
	useEffect(() => {
		if (!applyingElsewhere) return;
		const timer = setInterval(() => void reload(), POLL_MS);
		return () => clearInterval(timer);
	}, [applyingElsewhere, reload]);

	const apply = useCallback(async () => {
		const total = view?.counts.toApply ?? 0;
		setProgress({ done: 0, total });
		const answer = await streams("proposals.apply", { id });
		if (!("events" in answer)) {
			setProgress(null);
			const reason = ((answer.body ?? {}) as { reason?: Parameters<typeof t>[0] }).reason;
			toast.error(t(reason ?? "errors.unexpected"));
			return void reload();
		}
		try {
			for await (const event of answer.events as AsyncIterable<ApplyEvent>)
				if (event.type === "item") setProgress({ done: event.done, total: event.total });
		} catch {
			// The connection went; the apply goes on by itself (doc 00), and the proposal is read until it is over.
		}
		setProgress(null);
		await reload();
		// What it changed shows wherever it is listed.
		wrote();
		touchProposals();
	}, [streams, id, view?.counts.toApply, reload, wrote, touchProposals, t]);

	const discard = useCallback(async () => {
		const done = await discarding.run({ proposal: id });
		if (!done.ok) toast.error(t(done.refusal.reason ?? "errors.unexpected"));
		await reload();
		touchProposals();
	}, [discarding.run, id, reload, touchProposals, t]);

	const revert = useCallback(async () => {
		const done = await reverting.run({ id });
		if (!done.ok) toast.error(t(done.refusal.reason ?? "errors.unexpected"));
		await reload();
		touchProposals();
	}, [reverting.run, id, reload, touchProposals, t]);

	const include = useCallback(
		async (items: ProposalItemView[], included: boolean) => {
			const ids = items.filter((item) => item.state === "pending" && item.included !== included).map((item) => item.id);
			if (ids.length === 0) return;
			const done = await including.run({ ids, included });
			if (!done.ok) toast.error(t(done.refusal.reason ?? "errors.unexpected"));
			await reload();
			touchProposals();
		},
		[including.run, reload, touchProposals, t],
	);

	/** Asks the assistant to make one change again on its record as it is now: a small run of its own, read to its end. */
	const remake = useCallback(
		async (item: string) => {
			setRemaking(item);
			const answer = await streams("assistant.run", { again: item });
			if ("events" in answer) {
				try {
					for await (const _event of answer.events) {
						// Nothing of it is shown but its result: the row with its new change.
					}
				} catch {
					// The connection went: the row is read again as it stands.
				}
			} else {
				const reason = ((answer.body ?? {}) as { reason?: Parameters<typeof t>[0] }).reason;
				toast.error(t(reason ?? "errors.unexpected"));
			}
			setRemaking(null);
			await reload();
			touchProposals();
		},
		[streams, reload, touchProposals, t],
	);

	return {
		view,
		reload,
		remake,
		remaking,
		/** While it is being applied, here or elsewhere: how far, when this page knows. */
		applying: progress !== null || view?.applying === true,
		progress,
		apply,
		discard,
		revert,
		include,
		busy: discarding.pending || reverting.pending,
	};
}

/** Where a proposal stands, from what its items became. */
export type ProposalStanding = "waiting" | "applying" | "applied" | "reverted" | "discarded";

export function standingOf(view: ProposalView, applying: boolean): ProposalStanding {
	if (applying) return "applying";
	if (view.items.some((item) => item.state === "pending" || item.state === "stale")) return "waiting";
	if (view.status === "discarded") return "discarded";
	if (view.status === "reverted") return "reverted";
	return "applied";
}
