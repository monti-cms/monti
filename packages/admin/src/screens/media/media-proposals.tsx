"use client";

import { useTranslator } from "@monti-cms/core/site";
import { MemoCardPopover, MemoMessage, MemoThread, ProposalBar } from "@monti-cms/ui";
import { Fragment, type ReactNode, useRef, useState } from "react";
import { type MediaProposalItem, type MediaProposals, useAdminComponents } from "../../admin-components";
import { proposalMarksMessages } from "../../editor/proposals/messages";
import { mediaMessages } from "./messages";

/** The attribute on a tile's cell while a proposal waits on it: where its card hangs. */
export const MEDIA_PROPOSAL_ATTRIBUTE = "data-media-proposal";

const NO_PROPOSALS = (): MediaProposals | null => null;

/** The time of day of an ISO date ("10:58"). */
const timeOf = (iso: string) => {
	const at = new Date(iso);
	return Number.isNaN(at.getTime())
		? ""
		: `${String(at.getHours()).padStart(2, "0")}:${String(at.getMinutes()).padStart(2, "0")}`;
};

export interface MediaProposalCards {
	/** The proposed alt text of a file, while one waits on it. */
	readonly proposalFor: (mediaId: string) => string | undefined;
	/** Opens the card of the proposal on a file. */
	readonly open: (mediaId: string) => void;
	/** The toolbar over the grid while proposals wait ("✦ Proposals 3 · Discard all · Accept all"); `null` while none does. */
	readonly bar: ReactNode;
	/** The card of the tile pressed, under it. */
	readonly card: ReactNode;
}

/**
 * The assistant's alt text proposals on the media library's tiles (flow 6 · 25–26), from the plugin that registers `mediaProposals`: the new text on the
 * tile in the blue pencil, the toolbar with discard all and accept all, and the card a tile opens with discard, accept and the row to ask again. A
 * request being worked on can be stopped; a stopped one stays in the card, marked so, as in the chat.
 */
export function useMediaProposalCards(): MediaProposalCards {
	const useProposals = useAdminComponents().mediaProposals ?? NO_PROPOSALS;
	const source = useProposals();
	const t = useTranslator(proposalMarksMessages);
	const tm = useTranslator(mediaMessages);
	const [card, setCard] = useState<string | null>(null);
	const [draft, setDraft] = useState("");
	const [asking, setAsking] = useState<ReadonlyMap<string, string>>(new Map());
	const [stopped, setStopped] = useState<ReadonlyMap<string, readonly string[]>>(new Map());
	const running = useRef(new Map<string, AbortController>());
	const items = source?.items ?? [];
	const byMedia = new Map(items.map((item) => [item.mediaId, item]));
	const opened = items.find((item) => item.id === card);

	const ask = async (item: MediaProposalItem, text: string) => {
		if (!source?.onAsk) return;
		setDraft("");
		setAsking((before) => new Map([...before, [item.id, text]]));
		const controller = new AbortController();
		running.current.set(item.id, controller);
		try {
			const next = await source.onAsk(item, text, controller.signal);
			// The card stays open on the proposal that took its place.
			setCard((open) => (open === item.id ? next : open));
		} catch {
			// Stopped: what was asked stays in the card, marked stopped. Failed: the source says why, and what was written goes back in the box.
			if (controller.signal.aborted)
				setStopped((before) => new Map([...before, [item.id, [...(before.get(item.id) ?? []), text]]]));
			else setDraft(text);
		} finally {
			running.current.delete(item.id);
			setAsking((before) => new Map([...before].filter(([id]) => id !== item.id)));
		}
	};

	const bar =
		source && items.length > 0 ? (
			<ProposalBar
				label={tm("proposal.count", { count: items.length })}
				discardAllLabel={t("discardAll")}
				onDiscardAll={() => source.onDiscard(items)}
				acceptAllLabel={t("acceptAll")}
				onAcceptAll={() => source.onAccept(items)}
			/>
		) : null;

	const openedAsking = opened ? asking.get(opened.id) : undefined;
	const cardNode =
		source && opened ? (
			<MemoCardPopover
				anchor={() => document.querySelector(`[${MEDIA_PROPOSAL_ATTRIBUTE}="${CSS.escape(opened.mediaId)}"]`)}
				open
				onOpenChange={(open) => {
					if (!open) setCard(null);
				}}
				where={tm("proposal.where")}
				discardLabel={t("discard")}
				onDiscard={() => {
					source.onDiscard([opened]);
					setCard(null);
				}}
				discardShortcut={["mod", "Backspace"]}
				acceptLabel={t("accept")}
				onAccept={() => {
					source.onAccept([opened]);
					setCard(null);
				}}
				acceptShortcut={["mod", "Enter"]}
				{...(source.onAsk
					? {
							reply: {
								placeholder: t("reply"),
								value: draft,
								onValueChange: setDraft,
								onSend: (text: string) => void ask(opened, text),
								sendLabel: t("send"),
								...(openedAsking !== undefined
									? { stop: { label: t("stop"), onStop: () => running.current.get(opened.id)?.abort() } }
									: {}),
							},
						}
					: {})}
			>
				<MemoThread>
					{(opened.thread ?? []).length === 0 && openedAsking === undefined && !stopped.get(opened.id)?.length ? (
						// Nothing said in the card yet: the request the proposal came from.
						<MemoMessage author={t("me")}>{opened.request}</MemoMessage>
					) : (
						(opened.thread ?? []).map((message, index) => (
							<MemoMessage
								// biome-ignore lint/suspicious/noArrayIndexKey: messages are only ever added at the end
								key={index}
								author={message.author === "admin" ? t("me") : t("assistant")}
								ai={message.author === "assistant"}
								time={timeOf(message.at)}
							>
								{message.text}
							</MemoMessage>
						))
					)}
					{(stopped.get(opened.id) ?? []).map((text, index) => (
						// biome-ignore lint/suspicious/noArrayIndexKey: stopped requests are only ever added at the end
						<Fragment key={`stopped:${index}`}>
							<MemoMessage author={t("me")}>{text}</MemoMessage>
							<MemoMessage author={t("assistant")} ai time={t("stopped")} />
						</Fragment>
					))}
					{openedAsking !== undefined && (
						<>
							<MemoMessage author={t("me")}>{openedAsking}</MemoMessage>
							<MemoMessage author={t("assistant")} ai time={t("working")} />
						</>
					)}
				</MemoThread>
			</MemoCardPopover>
		) : null;

	return {
		proposalFor: (mediaId) => byMedia.get(mediaId)?.value,
		open: (mediaId) => {
			const item = byMedia.get(mediaId);
			if (item) setCard(item.id);
		},
		bar,
		card: cardNode,
	};
}
