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
import { OverflowMenuHorizontal, Renew, Undo } from "@monti-cms/ui/icons";
import { type ReactNode, useEffect, useState } from "react";
import { useAdmin } from "../../operations/admin-context";
import { useOperation, useRead } from "../../operations/use-operation";
import { linkTo, type Route } from "../../route";
import { useCoverCorner } from "../frame/admin-frame";
import { shortTime } from "../list/format";

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

/** One delivery's state in words, with the lists' status mark: the panel is about this one line, so "sent" is said too. */
function DeliveryState({ delivery, sending }: { delivery: ActivityDelivery; sending: boolean }) {
	const { t } = useAdmin();
	if (sending || delivery.state === "pending")
		return (
			<EntryStatus status="draft" quiet>
				{t("activity.delivery.pending")}
			</EntryStatus>
		);
	// Beside one delivery, and only here, the tries are counted: the list's cell says "failed", or how many deliveries did.
	if (delivery.state === "failed")
		return <EntryStatus status="failed">{t("activity.failedTimes", { count: delivery.attempts })}</EntryStatus>;
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
	onUndo: () => void;
	go: (route: Route) => void;
}) {
	const { t } = useAdmin();
	const read = useRead<ActivityDetail>("activity.get", { id }, { afterWrites: true });
	const schema = useRead<{ adminValues: Record<string, { label?: string }> }>("schema.read");
	const cancel = useOperation("deliveries.cancel");
	const [asking, setAsking] = useState<ActivityDelivery | null>(null);
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
	const confirmCancel = async () => {
		const delivery = asking;
		setAsking(null);
		if (!delivery) return;
		const result = await cancel.run({ id: delivery.id });
		if (!result.ok) return void toast.error(t(result.refusal.reason ?? "errors.unexpected"));
		toast(t("activity.canceled"));
	};
	return (
		<>
			<SidePanel
				width="side"
				title={title}
				onClose={onClose}
				actions={
					failed.length > 0 || (line.undo.state === "open" && !undoing) ? (
						<DropdownMenu>
							<IconButton label={t("list.rowMenu")} trigger={(button) => <DropdownMenuTrigger render={button} />}>
								<OverflowMenuHorizontal aria-hidden />
							</IconButton>
							<DropdownMenuContent align="end">
								{failed.length > 0 && (
									<DropdownMenuItem disabled={busy} onClick={() => onRetry(failed.map((delivery) => delivery.id))}>
										<Renew aria-hidden />
										{t("activity.retry")}
									</DropdownMenuItem>
								)}
								{line.undo.state === "open" && !undoing && (
									<DropdownMenuItem onClick={onUndo}>
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
									<Stack key={delivery.id} gap={8} align="start">
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
										{(delivery.state === "failed" || delivery.state === "pending") && !isSending(delivery) && (
											<Inline gap={16}>
												{delivery.state === "failed" && (
													<TextButton variant="underline" loading={busy} onClick={() => onRetry([delivery.id])}>
														{t("activity.retry")}
													</TextButton>
												)}
												<TextButton variant="quiet" onClick={() => setAsking(delivery)}>
													{t("activity.cancel")}
												</TextButton>
											</Inline>
										)}
									</Stack>
								))}
							</Stack>
						</Group>
					)}
				</Stack>
			</SidePanel>
			{/* Canceling cannot be taken back, so it asks (flow 12·04). */}
			<AlertDialog open={asking !== null} onOpenChange={(open) => !open && setAsking(null)}>
				<AlertDialogContent>
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
						<AlertDialogAction variant="danger" onClick={() => void confirmCancel()}>
							{t("activity.cancelConfirm")}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	);
}
