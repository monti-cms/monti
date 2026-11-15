import { AiFailed, AiWorking, Marker, MemoCardPopover, MemoMessage, MemoThread } from "@monti-cms/ui";
import { type ComponentProps, useRef } from "react";
import { toWhatStands, useFocusHandOff } from "../screens/frame/focus-hand-off";
import type { Exchange } from "./use-place-requests";

type Translate = (key: string, values?: Record<string, string | number>) => string;

/**
 * A mark that opens and closes its card. The press that closes an open card is first heard by the card as a press outside it, which
 * closes it; the click that follows would open it again. So what the click does is settled when the press begins.
 */
export function CardMark({
	open,
	onToggle,
	...props
}: Omit<ComponentProps<typeof Marker>, "active" | "onClick"> & { open: boolean; onToggle: (open: boolean) => void }) {
	const wasOpen = useRef(false);
	return (
		<Marker
			active={open}
			onPointerDown={() => {
				wasOpen.current = open;
			}}
			onClick={(event) => {
				// A key press has no pointer before it: it toggles what is there now.
				onToggle(event.detail === 0 ? !open : !wasOpen.current);
			}}
			{...props}
		/>
	);
}

/**
 * A card whose controls come and go while the assistant works: its reply row gives way to "Generating · Stop" when a request is sent, and
 * comes back, or a failure line with "Try again" does, when the work ends. The keyboard's focus goes with them: to "Stop", then to what
 * is there after. A pointer's press moves nothing (`useFocusHandOff`).
 */
export function KeptCard(props: ComponentProps<typeof MemoCardPopover>) {
	// What stands where the work was, first found first: "Stop", "Try again", the reply box, then any button of the card.
	const keep = useFocusHandOff((card) =>
		toWhatStands(card, [
			"[data-slot=ai-working] button",
			"[data-slot=ai-failed] button",
			"input",
			"button:not([disabled])",
		]),
	);
	return <MemoCardPopover ref={keep} {...props} />;
}

/** What a card's reply row does, when the site has the assistant: sends what was written, and stops the work on it. */
export type CardReply = {
	/** The words in the box of the open card. */
	draft: string;
	onDraft: (words: string) => void;
	onSend: (words: string) => void;
	onStop: () => void;
};

/** A request at a place that did not go: its one failure line, and what its button does ("Try again", or "Go on" past a limit). */
export type CardFailure = { why: string; next: "retry" | "goOn" | null; onAgain: () => void };

/**
 * What was asked and answered at a place, as a card's thread: the person's words, then the assistant's. While the assistant works its
 * answer grows in place, with "Generating · Stop" under it; a request that did not go ends with its failure line.
 */
export function MemoThreadOf({
	t,
	thread,
	working,
	onStop,
	failure,
}: {
	t: Translate;
	thread: readonly Exchange[];
	working: boolean;
	onStop?: () => void;
	failure?: CardFailure | null;
}) {
	if (thread.length === 0) return null;
	return (
		<MemoThread>
			{thread.flatMap((exchange, at) => {
				const isLast = at === thread.length - 1;
				return [
					// biome-ignore lint/suspicious/noArrayIndexKey: a thread only grows at its end
					<MemoMessage key={`asked:${at}`} author={t("memo.me")}>
						{exchange.request}
					</MemoMessage>,
					exchange.answer || (isLast && working) ? (
						<MemoMessage
							// biome-ignore lint/suspicious/noArrayIndexKey: a thread only grows at its end
							key={`answered:${at}`}
							author={t("memo.assistant")}
							ai
							status={isLast && working ? <AiWorking onStop={onStop} /> : undefined}
						>
							{exchange.answer || undefined}
						</MemoMessage>
					) : null,
				];
			})}
			{failure && !working ? (
				<AiFailed
					onRetry={failure.next ? failure.onAgain : undefined}
					retryLabel={failure.next === "goOn" ? t("panel.goOn") : undefined}
				>
					{failure.why}
				</AiFailed>
			) : null}
		</MemoThread>
	);
}

/** The card's reply row: none while the assistant works on what was sent (its line under the answer stops it). */
export const replyOf = (t: Translate, reply: CardReply | undefined, working: boolean, first: boolean) =>
	reply && !working
		? {
				placeholder: t(first ? "memo.request" : "memo.continue"),
				value: reply.draft,
				onValueChange: reply.onDraft,
				onSend: reply.onSend,
				sendLabel: t(first ? "memo.send" : "memo.continue"),
				focus: first,
			}
		: undefined;

/**
 * One proposed change's own card (doc 05, "one by one"; T41), the same on every screen that draws proposals where they apply: the text's
 * margin in the editor, the changes list in the settings. Its head discards or takes that change alone; under it, what was asked for
 * and what was asked at this place since; at its foot, a box to ask for it to be changed again ("continue"). While the assistant works
 * on such a request the head and the box are gone and the answer's line stops it; one that did not go stays, with its failure line.
 * Without `reply` (a site without the assistant) it has no box.
 */
export function ProposalMemo({
	t,
	anchor,
	open,
	onClose,
	request,
	thread,
	asked,
	failure,
	onDiscard,
	onTake,
	reply,
}: {
	t: Translate;
	/** The element the card hangs under. */
	anchor: () => Element | null;
	open: boolean;
	onClose: () => void;
	/** The request the change came from. */
	request: string;
	/** What was asked of it at its place since, with the answers. */
	thread: readonly Exchange[];
	/** What is being asked of it now, or what was asked last and did not go. */
	asked: Exchange | null;
	/** The last request at it did not go: why, and the way to ask again. */
	failure?: CardFailure | null;
	onDiscard: () => void;
	onTake: () => void;
	reply?: CardReply;
}) {
	const working = asked !== null && !failure;
	return (
		<KeptCard
			anchor={anchor}
			open={open}
			onOpenChange={(next) => {
				if (!next) onClose();
			}}
			{...(working
				? {}
				: {
						discardLabel: t("card.discard"),
						onDiscard: () => {
							onClose();
							onDiscard();
						},
						acceptLabel: t("memo.take"),
						onAccept: () => {
							onClose();
							onTake();
						},
					})}
			reply={open ? replyOf(t, reply, working, false) : undefined}
		>
			<MemoThreadOf
				t={t}
				thread={[{ request, answer: "" }, ...thread, ...(asked ? [asked] : [])]}
				working={working}
				onStop={reply?.onStop}
				failure={failure}
			/>
		</KeptCard>
	);
}
