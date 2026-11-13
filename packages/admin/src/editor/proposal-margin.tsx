import { EditorMargin, Marker, MemoCardPopover, MemoDiff } from "@monti-cms/ui";
import type { Editor } from "@tiptap/react";
import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { useAdmin } from "../operations/admin-context";
import { type BodyProposal, findBlock, proposedWords } from "./proposal-marks";

/** A proposal the text has moved away from, with the block it hangs beside (`staleProposals`). */
export type StaleProposal = { item: BodyProposal; block: string };

/**
 * The assistant's body proposals the text has moved away from (doc 10, item 18; T87): each hangs in the left margin of its block as a mark
 * that opens its card, the one a translation's "source changed" uses. The card says "changed in the meantime", shows the block's words as
 * they were when the change was proposed and what was proposed, and has two ways out: discard it, or have the assistant make it again on
 * the text as it is (`onRemake`; left out on a site without the assistant).
 */
export function StaleProposalMargin({
	editor,
	stale,
	open,
	onOpen,
	onDiscard,
	onRemake,
	remaking,
}: {
	editor: Editor;
	stale: readonly StaleProposal[];
	/** The proposal whose card is open (the bubble walked to it, or its mark was pressed). */
	open: string | null;
	onOpen: (id: string | null) => void;
	onDiscard: (id: string) => void;
	onRemake?: (id: string) => void;
	/** The proposals the assistant is making again now: each mark says "…" meanwhile. */
	remaking: ReadonlySet<string>;
}) {
	const { t } = useAdmin();
	const [tops, setTops] = useState<Record<string, number>>({});
	// Another mark hung at the same block (a translation's "changed" or "source", another stale proposal): this one stands to its left,
	// 4px off.
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
			(margin) => !margin.querySelector("[data-stale-proposal]") && margin.offsetWidth > 0,
		);
		for (const { item, block } of stale) {
			const element = blockOf(block);
			if (!element) continue;
			const top = element.getBoundingClientRect().top - origin;
			next[item.id] = top;
			const other = others.find((margin) => Math.abs(margin.getBoundingClientRect().top - origin - top) < 2);
			// The stale marks before this one at the same block, as wide as they are drawn (none yet on the first pass: measured again
			// once they are).
			const before = stale
				.slice(0, stale.indexOf(stale.find((each) => each.item.id === item.id) ?? stale[0]))
				.filter((each) => each.block === block)
				.reduce((sum, each) => {
					const drawn = body.querySelector<HTMLElement>(`[data-stale-proposal="${each.item.id}"]`);
					return sum + (drawn ? drawn.offsetWidth + 4 : 0);
				}, 0);
			taken[item.id] = (other ? other.offsetWidth + 4 : 0) + before;
		}
		const same = (now: Record<string, number>, was: Record<string, number>) =>
			Object.keys(now).length === Object.keys(was).length &&
			Object.entries(now).every(([id, value]) => was[id] === value);
		setTops((was) => (same(next, was) ? was : next));
		setBesides((was) => (same(taken, was) ? was : taken));
	}, [editor, stale, blockOf]);
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

	return stale.map(({ item, block }) => {
		const top = tops[item.id];
		if (top === undefined) return null;
		const words = proposedWords(item, block);
		const was = item.was?.[block];
		const working = remaking.has(item.id);
		return (
			<EditorMargin key={item.id} top={top} beside={besides[item.id] ?? 0}>
				<span data-stale-proposal={item.id}>
					<Marker
						active={open === item.id}
						aria-label={t("card.item.stale")}
						onClick={() => onOpen(open === item.id ? null : item.id)}
					>
						{working ? "…" : 1}
					</Marker>
				</span>
				<MemoCardPopover
					anchor={() => blockOf(block)}
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
			</EditorMargin>
		);
	});
}
