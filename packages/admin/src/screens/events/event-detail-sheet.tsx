"use client";

import { useSite, useTranslator } from "@monti-cms/core/site";
import {
	DescriptionItem,
	DescriptionList,
	EntryStatus,
	Heading,
	Inline,
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
	Stack,
	Text,
} from "@monti-cms/ui";
import type { ReactNode } from "react";
import type { EventDeliveryItem } from "../../api/events";
import { formatDateTime } from "../shared/format-date";
import { eventCollectionLabel, eventEntryLabel, STATE_STATUS } from "./event-display";
import { eventsMessages } from "./messages";

/** One group of the detail: a small heading with its rows, separated from the group before by a hairline. */
function Band({ title, first = false, children }: { title: string; first?: boolean; children: ReactNode }) {
	return (
		<Stack as="section" gap={8} padding={16} border={first ? undefined : "top"}>
			<Heading as="h3" variant="label">
				{title}
			</Heading>
			<DescriptionList>{children}</DescriptionList>
		</Stack>
	);
}

const Mono = ({ children }: { children: ReactNode }) => (
	<Text variant="caption" mono>
		{children}
	</Text>
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
			<SheetContent size="md" scroll>
				<SheetHeader>
					<SheetTitle>
						{change ? `${t(`kind.${change.kind}`)} · ${eventEntryLabel(change)}` : t("detail.title")}
					</SheetTitle>
					<SheetDescription>{t("detail.description")}</SheetDescription>
				</SheetHeader>
				{item && change && (
					<Stack gap={0}>
						<Band first title={t("detail.section.event")}>
							<DescriptionItem label={t("detail.eventId")}>
								<Mono>{change.eventId}</Mono>
							</DescriptionItem>
							<DescriptionItem label={t("column.kind")}>{t(`kind.${change.kind}`)}</DescriptionItem>
							<DescriptionItem label={t("column.when")}>{formatDateTime(site, change.occurredAt)}</DescriptionItem>
							<DescriptionItem label={t("column.actor")}>{change.actor ?? "—"}</DescriptionItem>
						</Band>
						<Band title={t("detail.section.entry")}>
							<DescriptionItem label={t("detail.title.entry")}>{change.title ?? "—"}</DescriptionItem>
							<DescriptionItem label={t("detail.entryId")}>
								<Mono>{change.entryId}</Mono>
							</DescriptionItem>
							<DescriptionItem label={t("detail.collection")}>
								{eventCollectionLabel(site, change.collection)}
							</DescriptionItem>
							<DescriptionItem label={t("detail.locale")}>{change.locale ?? "—"}</DescriptionItem>
							<DescriptionItem label={t("detail.workingSlug")}>
								{change.workingSlug ? <Mono>{change.workingSlug}</Mono> : "—"}
							</DescriptionItem>
							<DescriptionItem label={t("detail.publishedSlug")}>
								{change.publishedSlug ? <Mono>{change.publishedSlug}</Mono> : "—"}
							</DescriptionItem>
							<DescriptionItem label={t("detail.translationGroup")}>
								{change.translationGroupId ? <Mono>{change.translationGroupId}</Mono> : "—"}
							</DescriptionItem>
							<DescriptionItem label={t("detail.version")}>{change.version ?? "—"}</DescriptionItem>
						</Band>
						<Band title={t("detail.section.delivery")}>
							<DescriptionItem label={t("detail.subscribers")}>
								{deliveries.some((delivery) => delivery.subscriber !== null) ? (
									<Stack as="ul" gap={8}>
										{deliveries.map((delivery) => (
											<Stack as="li" key={delivery.subscriber ?? ""} gap={2}>
												<Inline gap={8}>
													<Mono>{delivery.subscriber ?? ""}</Mono>
													<EntryStatus status={STATE_STATUS[delivery.state]}>
														{t(`state.${delivery.state}`)}
													</EntryStatus>
												</Inline>
												<Text as="div" variant="caption" tone="muted">
													{t("detail.attempts", { count: delivery.attempts })}
													{delivery.lastAttemptAt ? ` · ${formatDateTime(site, delivery.lastAttemptAt)}` : ""}
												</Text>
												{delivery.lastError && (
													<Text as="div" variant="caption" tone="danger">
														{delivery.lastError}
													</Text>
												)}
											</Stack>
										))}
									</Stack>
								) : (
									t("state.recorded")
								)}
							</DescriptionItem>
						</Band>
					</Stack>
				)}
			</SheetContent>
		</Sheet>
	);
}
