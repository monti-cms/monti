"use client";

import {
	fileTypeLabel,
	formatFileSize,
	trashDaysLeft,
	useSite,
	useTranslator,
	withBasePath,
} from "@monti-cms/core/site";
import {
	Button,
	DescriptionItem,
	DescriptionList,
	DotNote,
	Image,
	Inline,
	SidePanel,
	Stack,
	Text,
	TextButton,
} from "@monti-cms/ui";
import { useQuery } from "@tanstack/react-query";
import { entriesKeys } from "../../api/entries";
import { getReferrers, type TrashEntryJson, type TrashItemJson, type TrashMediaJson } from "../../api/trash";
import { commonMessages } from "../../lib/common.messages";
import { AdminLink as Link } from "../../router";
import { entryHref } from "../shared/entry-href";
import { formatDateTime } from "../shared/format-date";
import { collectionNoun } from "../shared/noun.messages";
import { trashMessages } from "./messages";
import { titleOf, usagesFromReferrers } from "./trash-model";

/** The day as the panel writes it: with the year ("2026. 09. 30."). */
const fullDate = (site: Parameters<typeof formatDateTime>[0], value: string) =>
	formatDateTime(site, value, { year: "numeric", month: "2-digit", day: "2-digit" });

/** What points at an entry in the trash through its relation fields; the entries in the trash say so. Nothing is drawn until they are known. */
function Referrers({ item }: { item: TrashEntryJson }) {
	const site = useSite();
	const t = useTranslator(trashMessages);
	const tc = useTranslator(commonMessages);
	const relations = useQuery({
		queryKey: entriesKeys.relations(item.id),
		queryFn: ({ signal }) =>
			getReferrers(site, item.id, signal).then((data) => usagesFromReferrers(data.incomingReferences)),
	});
	if (!relations.data) return null;
	return (
		<Stack gap={4}>
			<Text as="p" variant="micro" mono tone="subtle">
				{t("panel.pointing", { count: relations.data.length })}
			</Text>
			<Stack as="ul" gap={0}>
				{relations.data.map((usage) => (
					<li key={usage.entryId}>
						<Inline gap={8} justify="between" paddingY={8}>
							<TextButton render={<Link href={entryHref(site, usage.collection, usage.entryId)} />}>
								{usage.title || tc("untitled")}
							</TextButton>
							<Text variant="micro" tone="subtle">
								{usage.trashed
									? t("panel.inTrash", { collection: collectionNoun(site, usage.collection) })
									: collectionNoun(site, usage.collection)}
							</Text>
						</Inline>
					</li>
				))}
			</Stack>
		</Stack>
	);
}

/** Where a file is used: a file in use is never in the trash, so it is nowhere. */
function UsedIn() {
	const t = useTranslator(trashMessages);
	return (
		<Stack gap={4}>
			<Text as="p" variant="micro" mono tone="subtle">
				{t("panel.usedIn")}
			</Text>
			<Text as="p" variant="note" tone="faint">
				{t("panel.none")}
			</Text>
		</Stack>
	);
}

function mediaType(imageLabel: string, item: TrashMediaJson): string {
	return item.mimeType?.startsWith("image/")
		? `${imageLabel} · ${fileTypeLabel(item.filename, item.mimeType)}`
		: fileTypeLabel(item.filename, item.mimeType);
}

/**
 * The read-only panel beside the trash for a row that opens nothing else: an item (a tag, a category) or a file. The name is its title; under it the
 * state, what it is, what points at it (or where it is used), and at the foot the permanent delete (left) and the restore (right).
 */
export function TrashPanel({
	item,
	now,
	onClose,
	onRestore,
	onDelete,
}: {
	item: Exclude<TrashItemJson, { type: "folder" }>;
	now: Date;
	onClose: () => void;
	onRestore: () => void;
	onDelete: () => void;
}) {
	const site = useSite();
	const t = useTranslator(trashMessages);
	const tc = useTranslator(commonMessages);
	// A thing inside a trashed folder carries the folder's day, so its own date counts the same days.
	const left = trashDaysLeft(new Date(item.deletedAt), now);
	const title = titleOf(site, item);
	return (
		<SidePanel
			title={title}
			onClose={onClose}
			footer={
				<Inline justify="between" grow>
					<TextButton variant="danger" onClick={onDelete}>
						{tc("lifecycle.deletePermanently")}
					</TextButton>
					<Button type="button" onClick={onRestore}>
						{tc("lifecycle.restore")}
					</Button>
				</Inline>
			}
		>
			<DotNote>{t("panel.state", { left: t("row.left", { count: left }) })}</DotNote>
			{item.type === "media" ? (
				<>
					<Image ratio="photo" fit="contain" src={item.url ? withBasePath(item.url) : null} alt={title} />
					<DescriptionList>
						<DescriptionItem label={t("panel.type")}>{mediaType(t("meta.image"), item)}</DescriptionItem>
						<DescriptionItem label={t("panel.size")}>
							{item.width && item.height ? `${item.width}×${item.height} · ` : ""}
							{formatFileSize(item.byteSize ?? 0)}
						</DescriptionItem>
						<DescriptionItem label={t("panel.folder")}>{item.path.join(" / ") || "—"}</DescriptionItem>
						<DescriptionItem label={t("panel.deleted")}>{fullDate(site, item.deletedAt)}</DescriptionItem>
					</DescriptionList>
					<UsedIn />
				</>
			) : (
				<>
					<DescriptionList>
						<DescriptionItem label={t("panel.collection")}>{collectionNoun(site, item.collection)}</DescriptionItem>
						<DescriptionItem label={t("panel.name")}>{title}</DescriptionItem>
						{item.slug && <DescriptionItem label={t("panel.address")}>{item.slug}</DescriptionItem>}
						<DescriptionItem label={t("panel.deleted")}>{fullDate(site, item.deletedAt)}</DescriptionItem>
					</DescriptionList>
					<Referrers item={item} />
				</>
			)}
		</SidePanel>
	);
}
