"use client";

import { useSite, useTranslator } from "@monti-cms/core/site";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, StatusIndicator } from "@monti-cms/ui";
import type { ReactNode } from "react";
import type { EventDeliveryItem } from "../../api/events";
import { formatDateTime } from "../shared/format-date";
import { eventCollectionLabel, eventEntryLabel, STATE_TONE } from "./event-display";
import { eventsMessages } from "./messages";

function Row({ label, children }: { label: string; children: ReactNode }) {
	return (
		<div className="grid grid-cols-[8rem_1fr] gap-normal py-condensed text-monti-label">
			<dt className="text-monti-muted">{label}</dt>
			<dd className="min-w-0 break-words">{children}</dd>
		</div>
	);
}

/** One group of the detail: a small caption, with its rows below, separated from the group before by a hairline. */
function Band({ title, children }: { title: string; children: ReactNode }) {
	return (
		<section className="border-monti-muted border-t px-comfortable py-comfortable first:border-t-0">
			<h3 className="mb-condensed text-monti-label">{title}</h3>
			<dl>{children}</dl>
		</section>
	);
}

const Mono = ({ children }: { children: ReactNode }) => (
	<span className="font-mono text-monti-caption">{children}</span>
);

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
					<div>
						<Band title={t("detail.section.event")}>
							<Row label={t("detail.eventId")}>
								<Mono>{change.eventId}</Mono>
							</Row>
							<Row label={t("column.kind")}>{t(`kind.${change.kind}`)}</Row>
							<Row label={t("column.when")}>{formatDateTime(site, change.occurredAt)}</Row>
							<Row label={t("column.actor")}>{change.actor ?? "—"}</Row>
						</Band>
						<Band title={t("detail.section.entry")}>
							<Row label={t("detail.title.entry")}>{change.title ?? "—"}</Row>
							<Row label={t("detail.entryId")}>
								<Mono>{change.entryId}</Mono>
							</Row>
							<Row label={t("detail.collection")}>{eventCollectionLabel(site, change.collection)}</Row>
							<Row label={t("detail.locale")}>{change.locale ?? "—"}</Row>
							<Row label={t("detail.workingSlug")}>{change.workingSlug ? <Mono>{change.workingSlug}</Mono> : "—"}</Row>
							<Row label={t("detail.publishedSlug")}>
								{change.publishedSlug ? <Mono>{change.publishedSlug}</Mono> : "—"}
							</Row>
							<Row label={t("detail.translationGroup")}>
								{change.translationGroupId ? <Mono>{change.translationGroupId}</Mono> : "—"}
							</Row>
							<Row label={t("detail.version")}>{change.version ?? "—"}</Row>
						</Band>
						<Band title={t("detail.section.delivery")}>
							<Row label={t("detail.subscribers")}>
								{deliveries.some((delivery) => delivery.subscriber !== null) ? (
									<ul className="space-y-condensed">
										{deliveries.map((delivery) => (
											<li key={delivery.subscriber ?? ""} className="space-y-hair">
												<div className="flex items-center gap-condensed">
													<Mono>{delivery.subscriber ?? ""}</Mono>
													<StatusIndicator tone={STATE_TONE[delivery.state]} label={t(`state.${delivery.state}`)} />
												</div>
												<div className="text-monti-caption text-monti-muted">
													{t("detail.attempts", { count: delivery.attempts })}
													{delivery.lastAttemptAt ? ` · ${formatDateTime(site, delivery.lastAttemptAt)}` : ""}
												</div>
												{delivery.lastError && (
													<div className="text-monti-caption text-monti-danger">{delivery.lastError}</div>
												)}
											</li>
										))}
									</ul>
								) : (
									t("state.recorded")
								)}
							</Row>
						</Band>
					</div>
				)}
			</SheetContent>
		</Sheet>
	);
}
