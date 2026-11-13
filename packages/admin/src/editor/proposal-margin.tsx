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
		for (const { item, block } of stale) {
			const element = blockOf(block);
			if (element) next[item.id] = element.getBoundingClientRect().top - origin;
		}
		setTops((was) =>
			Object.keys(next).length === Object.keys(was).length && Object.entries(next).every(([id, top]) => was[id] === top)
				? was
				: next,
		);
	}, [editor, stale, blockOf]);
	useLayoutEffect(() => measure(), [measure]);
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
			<EditorMargin key={item.id} top={top}>
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
