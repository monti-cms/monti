"use client";

import { STORED_DOCUMENT_VERSION, type StoredDocument } from "@monti-cms/core/document";
import { diffSources, type SourceChange, useSite, useTranslator } from "@monti-cms/core/site";
import {
	Box,
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	Grid,
	Stack,
	Text,
} from "@monti-cms/ui";
import type { TranslatorFor } from "../../translator";
import { entriesMessages } from "./messages";
import { DocPreview } from "./source-pane";

const kindLabels = (t: TranslatorFor<typeof entriesMessages>): Record<SourceChange["kind"], string> => ({
	changed: t("sourceChange.changed"),
	added: t("sourceChange.added"),
	removed: t("sourceChange.removed"),
	moved: t("sourceChange.moved"),
});

/** Text of a header-row fragment (`{"title":..}`, `{"labels":[..]}`). */
const headerText = (source: string) => {
	try {
		const value = JSON.parse(source) as { title?: unknown; labels?: unknown };
		if (typeof value.title === "string") return value.title;
		if (Array.isArray(value.labels)) return value.labels.join(" · ");
	} catch {
		// A broken fragment is shown as is.
	}
	return source;
};

/** The block of a unit as a document, for the preview. */
const unitDoc = (node: StoredDocument["content"][number]): StoredDocument => ({
	type: "doc",
	version: STORED_DOCUMENT_VERSION,
	content: [node],
});

function UnitView({ unit }: { unit: { kind: string; source: string; node: StoredDocument["content"][number] } }) {
	return unit.kind === "header" ? (
		<Text as="p">{headerText(unit.source)}</Text>
	) : (
		<DocPreview doc={unitDoc(unit.node)} />
	);
}

function ChangeItem({ change }: { change: SourceChange }) {
	const t = useTranslator(entriesMessages);
	// A block that only moved reads the same before and now, so it is shown once.
	const unedited = change.kind === "moved" && !change.edited;
	const before = change.kind === "added" || unedited ? null : change.before;
	const after = change.kind === "removed" ? null : change.after;
	const label = change.kind === "moved" && change.edited ? t("sourceChange.movedChanged") : kindLabels(t)[change.kind];
	return (
		<Stack as="li" gap={8} border="all" radius="md" padding={12}>
			<Box background="muted" radius="sm" paddingX={8} paddingY={2} width="fit">
				<Text variant="caption" weight="medium">
					{label}
				</Text>
			</Box>
			<Grid columns={2} gap={12}>
				{before && (
					<Stack gap={4} minWidth={0}>
						<Text as="p" variant="caption" tone="muted">
							{t("sourceChange.before")}
						</Text>
						<UnitView unit={before} />
					</Stack>
				)}
				{after && (
					<Stack gap={4} minWidth={0}>
						<Text as="p" variant="caption" tone="muted">
							{t("sourceChange.after")}
						</Text>
						<UnitView unit={after} />
					</Stack>
				)}
			</Grid>
		</Stack>
	);
}

/** List of blocks that differ between the source the translator last confirmed and the current source. */
export function SourceChangeDialog({
	open,
	onOpenChange,
	before,
	after,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	/** The stored documents of both versions. Blocks are compared by block id, and moves are shown. */
	before: StoredDocument | undefined;
	after: StoredDocument;
}) {
	const site = useSite();
	const t = useTranslator(entriesMessages);
	const changes = open && before ? diffSources(site, before, after) : null;
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent size="xl" scroll>
				<DialogHeader>
					<DialogTitle>{t("sourceChange.title")}</DialogTitle>
					<DialogDescription>{t("sourceChange.description")}</DialogDescription>
				</DialogHeader>
				{changes === null ? (
					<Text as="p" tone="muted">
						{t("sourceChange.cantCompare")}
					</Text>
				) : changes.length === 0 ? (
					<Text as="p" tone="muted">
						{t("sourceChange.none")}
					</Text>
				) : (
					<Stack as="ol" gap={12}>
						{changes.map((change, index) => (
							// biome-ignore lint/suspicious/noArrayIndexKey: the change list's identity is document order
							<ChangeItem key={index} change={change} />
						))}
					</Stack>
				)}
			</DialogContent>
		</Dialog>
	);
}
