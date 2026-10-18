"use client";

import { useSite, useTranslator } from "@monti-cms/core/site";
import type { ReactNode } from "react";
import type { EventDeliveryItem } from "../../api/events";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "../../ui/sheet";
import { StatusIndicator } from "../../ui/status-indicator";
import { formatDateTime } from "../shared/format-date";
import { eventEntryLabel, STATE_TONE } from "./event-display";
import { eventsMessages } from "./messages";

function Row({ label, children }: { label: string; children: ReactNode }) {
	return (
		<div className="grid grid-cols-[8rem_1fr] gap-3 py-2 text-sm">
			<dt className="text-monti-muted-foreground">{label}</dt>
			<dd className="min-w-0 break-words">{children}</dd>
		</div>
	);
}

const Mono = ({ children }: { children: ReactNode }) => <span className="font-mono text-xs">{children}</span>;

/**
 * Everything the log knows about one event: the entry it was made on, who made it and when, and how it went to each subscriber.
 * `deliveries` are the rows of the same event on the page (one per subscriber); `item` is the one that was opened.
 */
export function EventDetailSheet({
	item,
	deliveries,
	onClose,
}: {
	item: EventDeliveryItem | null;
	deliveries: readonly EventDeliveryItem[];
	onClose: () => void;
}) {
	const site = useSite();
	const t = useTranslator(eventsMessages);
	const change = item?.change;
	return (
		<Sheet open={item !== null} onOpenChange={(open) => !open && onClose()}>
			<SheetContent className="gap-0 overflow-y-auto sm:max-w-md">
				<SheetHeader>
					<SheetTitle>
						{change ? `${t(`kind.${change.kind}`)} · ${eventEntryLabel(change)}` : t("detail.title")}
					</SheetTitle>
					<SheetDescription>{t("detail.description")}</SheetDescription>
				</SheetHeader>
				{item && change && (
					<dl className="divide-y px-4 pb-4">
						<Row label={t("detail.eventId")}>
							<Mono>{change.eventId}</Mono>
						</Row>
						<Row label={t("column.kind")}>{t(`kind.${change.kind}`)}</Row>
						<Row label={t("column.when")}>{formatDateTime(site, change.occurredAt)}</Row>
						<Row label={t("column.actor")}>{change.actor ?? "—"}</Row>
						<Row label={t("detail.title.entry")}>{change.title ?? "—"}</Row>
						<Row label={t("detail.entryId")}>
							<Mono>{change.entryId}</Mono>
						</Row>
						<Row label={t("detail.collection")}>{change.collection}</Row>
						<Row label={t("detail.locale")}>{change.locale ?? "—"}</Row>
						<Row label={t("detail.workingSlug")}>{change.workingSlug ?? "—"}</Row>
						<Row label={t("detail.publishedSlug")}>{change.publishedSlug ?? "—"}</Row>
						<Row label={t("detail.translationGroup")}>
							{change.translationGroupId ? <Mono>{change.translationGroupId}</Mono> : "—"}
						</Row>
						<Row label={t("detail.version")}>{change.version ?? "—"}</Row>
						<Row label={t("detail.subscribers")}>
							{deliveries.some((delivery) => delivery.subscriber !== null) ? (
								<ul className="space-y-2">
									{deliveries.map((delivery) => (
										<li key={delivery.subscriber ?? ""} className="space-y-0.5">
											<div className="flex items-center gap-2">
												<span>{delivery.subscriber ?? ""}</span>
												<StatusIndicator tone={STATE_TONE[delivery.state]} label={t(`state.${delivery.state}`)} />
											</div>
											<div className="text-monti-muted-foreground text-xs">
												{t("detail.attempts", { count: delivery.attempts })}
												{delivery.lastAttemptAt ? ` · ${formatDateTime(site, delivery.lastAttemptAt)}` : ""}
											</div>
											{delivery.lastError && <div className="text-monti-destructive text-xs">{delivery.lastError}</div>}
										</li>
									))}
								</ul>
							) : (
								t("state.recorded")
							)}
						</Row>
					</dl>
				)}
			</SheetContent>
		</Sheet>
	);
}
