import type { ActivityDelivery, ActivityDetail, ActivityRecord, Message } from "@monti-cms/core";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	ChangeLine,
	ChangeLines,
	DescriptionItem,
	DescriptionList,
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
	EntryStatus,
	Heading,
	IconButton,
	Inline,
	SidePanel,
	Stack,
	Text,
	TextButton,
	toast,
} from "@monti-cms/ui";
import { Chat, OverflowMenuHorizontal, Renew, Undo } from "@monti-cms/ui/icons";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { useOpenConversation } from "../../assistant/use-assistant";
import { useAdmin } from "../../operations/admin-context";
import { reasonOf, useOperation, useRead } from "../../operations/use-operation";
import { linkTo, type Route } from "../../route";
import { useCoverCorner } from "../frame/admin-frame";
import { holdsKeyboardFocus, nextStop, useFocusHandOff } from "../frame/focus-hand-off";
import { shortTime } from "../list/format";

/**
 * One receiver's delivery in the panel: its facts, and what can be done about it under them. Its buttons go once it is canceled or has
 * arrived: the keyboard's focus they held goes to the delivery itself, whose state now says how that came out, not to the page.
 */
function DeliveryBlock({ id, children }: { id: string; children: ReactNode }) {
	const handOff = useFocusHandOff((block) => () => {
		if (block.isConnected && document.activeElement === document.body) block.focus();
	});
	return (
		<Stack ref={handOff} tabIndex={-1} data-delivery={id} gap={8} align="start">
			{children}
		</Stack>
	);
}

/** One group of the panel: a small heading and what is under it. */
function Group({ title, children }: { title: string; children: ReactNode }) {
	return (
		<Stack gap={12}>
			<Heading as="h3" variant="label">
				{title}
			</Heading>
			{children}
		</Stack>
	);
}

/** What an import's line keeps of its result (doc 14, `data.import`'s summary): `null` for any other line. */
function importOf(what: Message | undefined) {
	if (what?.key !== "data.import") return null;
	const values = what.values ?? {};
	let renamed: { id: string; title: string; from: string; to: string }[] = [];
	try {
		const read: unknown = JSON.parse(String(values.renamed ?? "[]"));
		if (Array.isArray(read)) renamed = read;
	} catch {}
	return {
		collection: String(values.collection ?? ""),
		items: Number(values.items ?? 0),
		skipped: Number(values.skipped ?? 0),
		renamed,
	};
}

/** One delivery's state in words, with the lists' status mark: the panel is about this one line, so "sent" is said too. */
function DeliveryState({ delivery, sending }: { delivery: ActivityDelivery; sending: boolean }) {
	const { t } = useAdmin();
	if (sending || delivery.state === "pending")
		return (
			<EntryStatus status="draft" quiet>
				{t("activity.delivery.pending")}
			</EntryStatus>
		);
	// Beside one delivery, and only here, the tries are counted, from the second on: one try that failed is "failed", as in the list's cell.
	if (delivery.state === "failed")
		return (
			<EntryStatus status="failed">
				{delivery.attempts > 1
					? t("activity.failedTimes", { count: delivery.attempts })
					: t("activity.delivery.failed")}
			</EntryStatus>
		);
	if (delivery.state === "canceled")
		return (
			<EntryStatus status="archived" quiet>
				{t("activity.delivery.canceled")}
			</EntryStatus>
		);
	return (
		<EntryStatus status="published" quiet>
			{t("activity.delivery.sent")}
		</EntryStatus>
	);
}

/**
 * A line of the activity log, beside the list (flow 12·03): when, what it touched as it was then, and each receiver's delivery with what can be
 * done about it. What can be done with the line itself is in the head's ⋯, the same as in its row's. Who did it is not said: one person uses the
 * admin, and the assistant's line says so by its request.
 */
export function ActivityPanel({
	id,
	say,
	deliveries,
	sending,
	busy,
	undoing,
	watched,
	onClose,
	onGone,
	onRetry,
	onUndo,
	go,
}: {
	id: string;
	/** A message of the log in the admin's language. */
	say: (message: Message) => string;
	/** Whether the site sends anything: without a receiver there is no delivery group (13-5). */
	deliveries: boolean;
	/** The deliveries being sent again now. */
	sending: readonly string[] | "all" | null;
	/** A send runs, here or elsewhere: no other can be started. */
	busy: boolean;
	/** An undo runs: no second one is offered. */
	undoing: boolean;
	/** Changes each time the screen looks again at deliveries on their way: the details read again with it. */
	watched: number;
	onClose: () => void;
	/** There is no such line (an old link): the screen takes it out of its address. */
	onGone: () => void;
	onRetry: (ids: string[]) => void;
	/**
	 * Undoes the line, once its question is answered. `whenGone` says where the focus goes if the head's ⋯ that asked is gone before the
	 * question has closed (an undo that answers at once).
	 */
	onUndo: (whenGone: () => HTMLElement | null) => void;
	go: (route: Route) => void;
}) {
	const { t, wrote } = useAdmin();
	const openConversation = useOpenConversation();
	const read = useRead<ActivityDetail>("activity.get", { id }, { afterWrites: true, quiet: true });
	const schema = useRead<{ adminValues: Record<string, { label?: string }> }>("schema.read");
	const cancel = useOperation("deliveries.cancel");
	const [asking, setAsking] = useState<ActivityDelivery | null>(null);
	/** The deliveries whose cancel is on its way or waits its turn: each one's "cancel" works and cannot be pressed again until its answer is in. */
	const [canceling, setCanceling] = useState<readonly string[]>([]);
	/** The cancels confirmed, one after the other: a second delivery's cancel confirmed while the first is on its way is sent when that one has answered. */
	const turn = useRef<Promise<void>>(Promise.resolve());
	/** The delivery whose cancel was confirmed by a press that held the keyboard's focus. */
	const canceled = useRef<string | null>(null);
	// The head's ⋯ goes when nothing is left to do with the line (sent again, undone): its focus goes to the next control of the head, the ×.
	const moreHandOff = useFocusHandOff((more) => nextStop(more));
	const line = read.data;
	// The corner's ✦ is covered only while a panel is there to cover it: not while it loads, not for a line that is gone.
	useCoverCorner(line !== null);
	const reload = read.reload;
	useEffect(() => {
		if (watched > 0) void reload();
	}, [watched, reload]);
	const gone = read.refusal?.reason?.key === "activity.unknown";
	// biome-ignore lint/correctness/useExhaustiveDependencies: once, when the read says the line is gone.
	useEffect(() => {
		if (gone) onGone();
	}, [gone]);
	if (!line) return null;
	const isSending = (delivery: ActivityDelivery) =>
		sending === "all" || (busy && sending === null)
			? delivery.state === "failed"
			: (sending ?? []).includes(delivery.id);
	const receiverOf = (delivery: ActivityDelivery) =>
		typeof delivery.receiver === "string" ? delivery.receiver : say(delivery.receiver);
	const failed = line.deliveries.filter((delivery) => delivery.state === "failed" && !isSending(delivery));
	// The head's ⋯ stays while what it started runs (a failed delivery on its way again, the undo's question and the undo itself): it goes only
	// once the line reads that nothing is left to do with it. By then the menu or the question has given its focus back to it, so that focus
	// can be handed on; and a plan that is refused leaves it where it was.
	const anyFailed = line.deliveries.some((delivery) => delivery.state === "failed");
	const title = line.request !== null ? `“${line.request}”` : line.what[0] ? say(line.what[0]) : "";
	/** Where a record opens, when it is still there to open. */
	const routeOf = (record: ActivityRecord): Route | null =>
		!record.exists
			? null
			: record.kind === "entry" && record.collection
				? { screen: "entry", collection: record.collection, id: record.id }
				: record.kind === "template"
					? { screen: "template", id: record.id }
					: null;
	const name = (record: ActivityRecord) => {
		const route = routeOf(record);
		const words = record.title || t("list.untitled");
		return route ? (
			<TextButton variant="underline" {...linkTo(route, go)}>
				{words}
			</TextButton>
		) : (
			words
		);
	};
	const [only] = line.records;
	const imported = importOf(line.what[0]);
	/** An entry whose address the import changed: a link while it is there to open (the records say so; an undone import's are gone). */
	const renamedName = (entry: { id: string; title: string }) => {
		const record = line.records.find((each) => each.id === entry.id);
		if (record) return name(record);
		return line.undo.state === "done" || !imported ? (
			entry.title
		) : (
			<TextButton
				variant="underline"
				{...linkTo({ screen: "entry", collection: imported.collection, id: entry.id }, go)}
			>
				{entry.title}
			</TextButton>
		);
	};
	// The assistant's line: the conversation its request was made in, while that conversation is kept.
	const conversation = openConversation && line.conversationKept ? line.conversationId : null;
	const confirmCancel = (byKeys: boolean) => {
		const delivery = asking;
		canceled.current = byKeys ? (delivery?.id ?? null) : null;
		setAsking(null);
		if (!delivery || canceling.includes(delivery.id)) return;
		setCanceling((ids) => [...ids, delivery.id]);
		turn.current = turn.current
			.then(async () => {
				try {
					const result = await cancel.run({ id: delivery.id });
					if (result.ok) return void toast(t("activity.canceled"));
					// What the panel shows is behind (the delivery went by itself, or was canceled in another tab): everything reads again, as when a
					// send is refused.
					wrote();
					toast.error(t(reasonOf(result.refusal)));
				} finally {
					setCanceling((ids) => ids.filter((id) => id !== delivery.id));
				}
			})
			// Whatever one cancel met, the next one confirmed is still sent.
			.catch(() => {});
	};
	return (
		<>
			<SidePanel
				width="side"
				title={title}
				onClose={onClose}
				actions={
					anyFailed || line.undo.state === "open" || conversation ? (
						<DropdownMenu>
							<IconButton
								ref={moreHandOff}
								label={t("list.more")}
								trigger={(button) => <DropdownMenuTrigger render={button} />}
							>
								<OverflowMenuHorizontal aria-hidden />
							</IconButton>
							<DropdownMenuContent align="end">
								{conversation && (
									<DropdownMenuItem onClick={() => openConversation?.(conversation)}>
										<Chat aria-hidden />
										{t("activity.conversation")}
									</DropdownMenuItem>
								)}
								{anyFailed && (
									<DropdownMenuItem
										disabled={busy || failed.length === 0}
										onClick={() => onRetry(failed.map((delivery) => delivery.id))}
									>
										<Renew aria-hidden />
										{t("activity.retry")}
									</DropdownMenuItem>
								)}
								{line.undo.state === "open" && (
									<DropdownMenuItem
										disabled={undoing}
										onClick={() =>
											onUndo(() => {
												const [first, ...more] = document.querySelectorAll<HTMLElement>(
													"[data-slot=side-panel-header] button",
												);
												// The ⋯ is still there: the question gives the focus back to it, and it hands it on if it goes.
												return more.length > 0 ? null : (first ?? null);
											})
										}
									>
										<Undo aria-hidden />
										{t("activity.undo")}
									</DropdownMenuItem>
								)}
							</DropdownMenuContent>
						</DropdownMenu>
					) : undefined
				}
			>
				<Stack gap={32}>
					{/* The first group has no heading, as in the other panels: the head names the line. */}
					<DescriptionList>
						<DescriptionItem label={t("activity.column.at")} mono>
							{shortTime(line.at)}
						</DescriptionItem>
						{line.undo.state === "done" && (
							<DescriptionItem label={t("activity.undoneAt")} mono>
								{shortTime(line.undo.at)}
							</DescriptionItem>
						)}
					</DescriptionList>
					{/* The head cuts a long request; here it is whole, with everything it did. */}
					{line.request !== null && (
						<Group title={t("activity.request")}>
							<Text>{line.request}</Text>
						</Group>
					)}
					{line.request !== null && (
						<Group title={t("activity.writes", { count: line.writes.length })}>
							<Stack gap={8}>
								{line.writes.map((write, index) => (
									// The writes of a line never change order.
									// biome-ignore lint/suspicious/noArrayIndexKey: two writes of a line can say the same words.
									<Text key={index} variant="note" tone="muted">
										{say(write)}
									</Text>
								))}
							</Stack>
						</Group>
					)}
					{imported && (
						<Group title={t("activity.import")}>
							<Stack gap={12} align="start">
								<Text variant="note" tone="muted">
									{[
										t("import.allDrafts"),
										imported.items > 0 ? t("import.newItems", { count: imported.items }) : "",
										imported.skipped > 0 ? t("import.skipped", { count: imported.skipped }) : "",
									]
										.filter(Boolean)
										.join(" · ")}
								</Text>
								{imported.renamed.length > 0 && (
									<Stack gap={8} width="full">
										<Text variant="note" tone="subtle">
											{t("import.renamed", { count: imported.renamed.length })}
										</Text>
										<ChangeLines>
											{imported.renamed.map((entry) => (
												<ChangeLine
													key={entry.id}
													what={renamedName(entry)}
													then={
														<Text mono variant="note">
															{entry.from} → {entry.to}
														</Text>
													}
												/>
											))}
										</ChangeLines>
									</Stack>
								)}
								<TextButton
									variant="underline"
									{...linkTo({ screen: "list", collection: imported.collection, params: new URLSearchParams() }, go)}
								>
									{t("import.toList")}
								</TextButton>
							</Stack>
						</Group>
					)}
					{line.recordCount === 1 && only ? (
						<Group title={t("activity.records")}>
							<DescriptionList>
								<DescriptionItem label={t(`activity.record.${only.kind}`)}>{name(only)}</DescriptionItem>
								{only.collection && (
									<DescriptionItem label={t("activity.collection")}>
										{schema.data?.adminValues[only.collection]?.label ?? only.collection}
									</DescriptionItem>
								)}
								{only.locale && (
									<DescriptionItem label={t("activity.locale")} mono>
										{`${only.locale.toUpperCase()}${only.version === null ? "" : ` · v${only.version}`}`}
									</DescriptionItem>
								)}
								{only.address && (
									<DescriptionItem label={t("activity.address")} mono>
										{only.address}
									</DescriptionItem>
								)}
							</DescriptionList>
						</Group>
					) : line.recordCount > 1 ? (
						<Group title={t("activity.recordsCount", { count: line.recordCount })}>
							<Stack gap={8} align="start">
								{line.records.map((record) => (
									<Text key={`${record.kind}:${record.id}`} variant="note">
										{name(record)}
									</Text>
								))}
								{line.recordCount > line.records.length && (
									<Text variant="note" tone="subtle">
										{t("activity.moreRecords", { count: line.recordCount - line.records.length })}
									</Text>
								)}
							</Stack>
						</Group>
					) : null}
					{deliveries && line.deliveries.length > 0 && (
						<Group title={t("activity.deliveriesCount", { count: line.deliveries.length })}>
							<Stack gap={20}>
								{line.deliveries.map((delivery) => (
									<DeliveryBlock key={delivery.id} id={delivery.id}>
										<DescriptionList>
											<DescriptionItem label={t("activity.destination")}>{receiverOf(delivery)}</DescriptionItem>
											<DescriptionItem label={t("activity.eventName")} mono>
												{delivery.event}
											</DescriptionItem>
											<DescriptionItem label={t("activity.state")}>
												<DeliveryState delivery={delivery} sending={isSending(delivery)} />
											</DescriptionItem>
											{delivery.lastError && delivery.state !== "sent" && (
												<DescriptionItem label={t("activity.lastError")}>{say(delivery.lastError)}</DescriptionItem>
											)}
											{delivery.nextAttemptAt && !isSending(delivery) && (
												<DescriptionItem label={t("activity.nextAttempt")} mono>
													{shortTime(delivery.nextAttemptAt)}
												</DescriptionItem>
											)}
											{/* The id the receiver got the event under (`Monti-Event-Id`, and `id` in the body): to find it in the receiver's own log. */}
											<DescriptionItem label={t("activity.eventId")} mono>
												{delivery.eventId}
											</DescriptionItem>
										</DescriptionList>
										{/* "Send again" stays while it is on its way: at work, with its focus, not to be pressed. When it arrives the buttons
										    go and the delivery takes the focus; when it fails, or its answer is lost, the button is as it was. */}
										{(delivery.state === "failed" || delivery.state === "pending") && (
											<Inline gap={16}>
												{delivery.state === "failed" && (
													<TextButton variant="underline" loading={busy} onClick={() => onRetry([delivery.id])}>
														{t("activity.retry")}
													</TextButton>
												)}
												{/* While its cancel is on its way it works, keeps its focus and cannot be pressed again: a second cancel
												    would only be refused. Not offered for a delivery that is being sent. */}
												{!isSending(delivery) && (
													<TextButton
														variant="quiet"
														loading={canceling.includes(delivery.id)}
														onClick={() => {
															canceled.current = null;
															setAsking(delivery);
														}}
													>
														{t("activity.cancel")}
													</TextButton>
												)}
											</Inline>
										)}
									</DeliveryBlock>
								))}
							</Stack>
						</Group>
					)}
				</Stack>
			</SidePanel>
			{/* Canceling cannot be taken back, so it asks (flow 12·04). */}
			<AlertDialog open={asking !== null} onOpenChange={(open) => !open && setAsking(null)}>
				{/* The question gives the focus back to "cancel", which works until the answer is in; when it then goes with the delivery's other
				    button, the focus is handed to the delivery by the rule (`DeliveryBlock`). When the answer is in before the question has
				    closed, the buttons are gone already: a cancel confirmed with the keyboard then gives the focus to the delivery itself. */}
				<AlertDialogContent
					finalFocus={() => {
						const block =
							canceled.current && document.querySelector<HTMLElement>(`[data-delivery="${canceled.current}"]`);
						return block && !block.querySelector("button") ? block : null;
					}}
				>
					<AlertDialogHeader>
						<AlertDialogTitle>{t("activity.cancelTitle")}</AlertDialogTitle>
						<AlertDialogDescription>
							<Text>{asking ? receiverOf(asking) : ""}</Text>
							<br />
							{t("activity.cancelText")}
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>{t("activity.cancelClose")}</AlertDialogCancel>
						<AlertDialogAction
							variant="danger"
							onClick={(event) => confirmCancel(holdsKeyboardFocus(event.currentTarget))}
						>
							{t("activity.cancelConfirm")}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	);
}
