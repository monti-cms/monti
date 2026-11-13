import { EditorMargin, MemoCardPopover, MemoDiff, MemoMessage, MemoThread } from "@monti-cms/ui";
import type { Editor } from "@tiptap/react";
import { type ReactNode, useCallback, useEffect, useLayoutEffect, useState } from "react";
import { CardMark, type CardReply, MemoThreadOf, ProposalMemo, replyOf } from "../assistant/proposal-memo";
import type { Exchange } from "../assistant/use-place-requests";
import { type BodyProposal, findBlock, proposedWords } from "./proposal-marks";

type Translate = (key: string, values?: Record<string, string | number>) => string;

/** A proposal the text has moved away from, with the block it hangs beside (`staleProposals`). */
export type StaleProposal = { item: BodyProposal; block: string };

/**
 * One mark hung in the text's left margin beside a block, with the card it opens: a proposed change (T41), one the text moved away from
 * (T87), a request left on picked words (T64). `draw` gets the block's element, where the card hangs.
 */
export type MarginMark = { id: string; block: string; draw: (anchor: () => HTMLElement | null) => ReactNode };

/**
 * The assistant's marks in the text's left margin, each level with its block. Marks at the same block stand side by side, 4px apart, and
 * left of another mark hung there (a translation's "changed" or "source").
 */
export function ProposalMargin({ editor, marks }: { editor: Editor; marks: readonly MarginMark[] }) {
	const [tops, setTops] = useState<Record<string, number>>({});
	const [besides, setBesides] = useState<Record<string, number>>({});

	const blockOf = useCallback(
		(block: string): HTMLElement | null => {
			if (editor.isDestroyed) return null;
			const found = findBlock(editor.state.doc, block);
			return found ? (editor.view.nodeDOM(found.pos) as HTMLElement | null) : null;
		},
		[editor],
	);
	const measure = useCallback(() => {
		if (editor.isDestroyed) return;
		const body = editor.view.dom.closest("[data-slot=editor-body]");
		if (!body) return;
		const origin = body.getBoundingClientRect().top;
		const next: Record<string, number> = {};
		const taken: Record<string, number> = {};
		const others = [...body.querySelectorAll<HTMLElement>("[data-slot=editor-margin]")].filter(
			(margin) => !margin.querySelector("[data-margin-mark]") && margin.offsetWidth > 0,
		);
		for (const [at, mark] of marks.entries()) {
			const element = blockOf(mark.block);
			if (!element) continue;
			const top = element.getBoundingClientRect().top - origin;
			next[mark.id] = top;
			const other = others.find((margin) => Math.abs(margin.getBoundingClientRect().top - origin - top) < 2);
			// The marks before this one at the same block, as wide as they are drawn (none yet on the first pass: measured again once
			// they are).
			const before = marks
				.slice(0, at)
				.filter((each) => each.block === mark.block)
				.reduce((sum, each) => {
					const drawn = body.querySelector<HTMLElement>(`[data-margin-mark="${CSS.escape(each.id)}"]`);
					return sum + (drawn ? drawn.offsetWidth + 4 : 0);
				}, 0);
			taken[mark.id] = (other ? other.offsetWidth + 4 : 0) + before;
		}
		const same = (now: Record<string, number>, was: Record<string, number>) =>
			Object.keys(now).length === Object.keys(was).length &&
			Object.entries(now).every(([id, value]) => was[id] === value);
		setTops((was) => (same(next, was) ? was : next));
		setBesides((was) => (same(taken, was) ? was : taken));
	}, [editor, marks, blockOf]);
	useLayoutEffect(() => measure(), [measure]);
	// Once the marks are drawn their widths are known: measured once more, which changes nothing when they already stand right.
	// biome-ignore lint/correctness/useExhaustiveDependencies: it follows what was last measured
	useLayoutEffect(() => measure(), [tops, besides]);
	useEffect(() => {
		// The text's lines move with its width and with what is typed: measured again whenever either changes.
		const resized = new ResizeObserver(() => measure());
		resized.observe(editor.view.dom);
		editor.on("update", measure);
		return () => {
			resized.disconnect();
			editor.off("update", measure);
		};
	}, [editor, measure]);

	return marks.map((mark) => {
		const top = tops[mark.id];
		if (top === undefined) return null;
		return (
			<EditorMargin key={mark.id} top={top} beside={besides[mark.id] ?? 0}>
				<span data-margin-mark={mark.id}>{mark.draw(() => blockOf(mark.block))}</span>
			</EditorMargin>
		);
	});
}

type Shared = {
	t: Translate;
	/** The mark whose card is open (the bubble walked to it, or it was pressed). */
	open: string | null;
	onOpen: (id: string | null) => void;
};

/**
 * The assistant's body proposals the text has moved away from (doc 10, item 18; T87): each hangs beside its block as a mark that opens
 * its card, the one a translation's "source changed" uses. The card says "changed in the meantime", shows the block's words as they
 * were when the change was proposed and what was proposed, and has two ways out: discard it, or have the assistant make it again on
 * the text as it is (`onRemake`; left out on a site without the assistant).
 */
export function staleMarks({
	t,
	open,
	onOpen,
	stale,
	onDiscard,
	onRemake,
	remaking,
}: Shared & {
	stale: readonly StaleProposal[];
	onDiscard: (id: string) => void;
	onRemake?: (id: string) => void;
	/** The proposals the assistant is making again now: each mark says "…" meanwhile. */
	remaking: ReadonlySet<string>;
}): MarginMark[] {
	return stale.map(({ item, block }) => ({
		id: item.id,
		block,
		draw: (anchor) => {
			const words = proposedWords(item, block);
			const was = item.was?.[block];
			const working = remaking.has(item.id);
			return (
				<>
					<CardMark
						open={open === item.id}
						aria-label={t("card.item.stale")}
						onToggle={(next) => onOpen(next ? item.id : null)}
					>
						{working ? "…" : 1}
					</CardMark>
					<MemoCardPopover
						anchor={anchor}
						open={open === item.id}
						onOpenChange={(next) => {
							if (!next) onOpen(null);
						}}
						where={t("card.item.stale")}
						discardLabel={t("card.discard")}
						onDiscard={() => {
							onOpen(null);
							onDiscard(item.id);
						}}
						{...(onRemake && !working
							? {
									acceptLabel: t("card.remake"),
									acceptSpark: true,
									onAccept: () => {
										onOpen(null);
										onRemake(item.id);
									},
								}
							: {})}
					>
						<MemoDiff
							afterLabel={t("entry.stale.proposed")}
							{...(was === undefined ? {} : { beforeLabel: t("entry.stale.then"), before: was })}
							{...(words === null ? { none: t("entry.stale.removed") } : { after: words })}
						/>
					</MemoCardPopover>
				</>
			);
		},
	}));
}

/**
 * One proposed change's own card (doc 05, "one by one"; T41): the mark beside its block opens it. Its head discards or takes that
 * change alone; under it, what was asked for and what was asked at this place since; at its foot, a box to ask for it to be changed
 * again ("continue"). While the assistant works on such a request the mark says "…", the head is gone and the box's button stops it.
 */
export function proposalMarks({
	t,
	open,
	onOpen,
	items,
	onDiscard,
	onTake,
	working,
	reply,
}: Shared & {
	/** The changes drawn over the text, each with the block its mark hangs beside. */
	items: readonly { item: BodyProposal & { request: string; thread: readonly Exchange[] }; block: string }[];
	onDiscard: (id: string) => void;
	onTake: (id: string) => void;
	/** For a change the assistant is asked to change again now: what was asked. */
	working: (id: string) => Exchange | null;
	/** The reply row of the open card; left out on a site without the assistant. */
	reply?: (id: string) => CardReply;
}): MarginMark[] {
	return items.map(({ item, block }) => ({
		id: item.id,
		block,
		draw: (anchor) => {
			const asked = working(item.id);
			const asks = 1 + item.thread.length + (asked ? 1 : 0);
			const shown = open === item.id;
			return (
				<>
					<CardMark
						open={shown}
						aria-label={t(asked ? "memo.markWorking" : "memo.mark", { request: item.request })}
						onToggle={(next) => onOpen(next ? item.id : null)}
					>
						{asked ? "…" : asks}
					</CardMark>
					<ProposalMemo
						t={t}
						anchor={anchor}
						open={shown}
						onClose={() => onOpen(null)}
						request={item.request}
						thread={item.thread}
						asked={asked}
						onDiscard={() => onDiscard(item.id)}
						onTake={() => onTake(item.id)}
						reply={reply?.(item.id)}
					/>
				</>
			);
		},
	}));
}

/**
 * The requests left on picked words (doc 10, item 28; T64): each hangs beside the block of its words. Before it is sent its card is a
 * box alone, with the caret in it; while the assistant works the mark says "…" and the box's button stops it; an answer that proposed
 * nothing stays in the card, to be asked again or let go.
 */
export function requestMarks({
	t,
	open,
	onOpen,
	requests,
	onDismiss,
	reply,
}: Shared & {
	requests: readonly {
		id: string;
		block: string;
		status: "writing" | "working" | "answered";
		thread: readonly Exchange[];
		failed: string | null;
	}[];
	onDismiss: (id: string) => void;
	reply: (id: string) => CardReply;
}): MarginMark[] {
	return requests.map((request) => ({
		id: request.id,
		block: request.block,
		draw: (anchor) => {
			const working = request.status === "working";
			const shown = open === request.id;
			return (
				<>
					<CardMark
						open={shown}
						aria-label={t(working ? "memo.requestWorking" : "memo.requestMark")}
						onToggle={(next) => {
							onOpen(next ? request.id : null);
							// A request nothing was written in leaves nothing behind.
							if (!next && request.status === "writing") onDismiss(request.id);
						}}
					>
						{working ? "…" : Math.max(1, request.thread.length)}
					</CardMark>
					<MemoCardPopover
						anchor={anchor}
						open={shown}
						onOpenChange={(next) => {
							if (next) return;
							onOpen(null);
							// A request nothing was written in leaves nothing behind.
							if (request.status === "writing") onDismiss(request.id);
						}}
						{...(request.status === "answered"
							? {
									discardLabel: t("card.discard"),
									onDiscard: () => {
										onOpen(null);
										onDismiss(request.id);
									},
								}
							: {})}
						reply={shown ? replyOf(t, reply(request.id), working, request.status === "writing") : undefined}
					>
						<MemoThreadOf t={t} thread={request.thread} working={working} />
						{request.failed ? (
							<MemoThread>
								<MemoMessage author={t("memo.assistant")} ai>
									{request.failed}
								</MemoMessage>
							</MemoThread>
						) : null}
					</MemoCardPopover>
				</>
			);
		},
	}));
}
