"use client";

// The compare screen of an entry: the version the person holds beside the server's copy, with what differs marked and the two ways out. It stands
// in for the editor while the address asks for it (`?compare=conflict` or `?compare=draft`), so what the editor holds is still there when it comes back.

import { ChevronLeft } from "@carbon/icons-react";
import { useSite, useTranslator } from "@monti-cms/core/site";
import {
	Button,
	Compare,
	CompareBody,
	CompareCode,
	CompareHeading,
	CompareParagraph,
	CompareProperty,
	CompareSide,
	CompareText,
	CompareTitle,
	Heading,
	Inline,
	Separator,
	Stack,
	StatusBar,
	StatusBarCell,
	StatusBarSpacer,
	Text,
	TextButton,
	toast,
} from "@monti-cms/ui";
import { useMemo } from "react";
import { AdminLink as Link, useAdminRouter } from "../../router";
import { entryPath } from "../shared/entry-address";
import { statusBarMessages } from "../shared/status-bar.messages";
import type { CompareMode } from "./compare-address";
import { type CompareBlock, compareEntries, type Segment } from "./compare-entries";
import { entryCompareMessages } from "./entry-compare.messages";
import type { EntryEditor } from "./entry-editor-types";
import { type EntryForm, formFromEntry } from "./entry-form";
import { clockTime, stampOf } from "./entry-stamps";

/** A run of text with the words that differ on the highlight. */
function Segments({ segments }: { segments: readonly Segment[] }) {
	return (
		<>
			{segments.map((segment, index) => (
				// biome-ignore lint/suspicious/noArrayIndexKey: the runs of a text are in reading order and never reorder
				<CompareText key={index} changed={segment.changed}>
					{segment.text}
				</CompareText>
			))}
		</>
	);
}

function Block({ block }: { block: CompareBlock }) {
	const text = <Segments segments={block.segments} />;
	if (block.kind === "heading") return <CompareHeading>{text}</CompareHeading>;
	if (block.kind === "code") return <CompareCode>{text}</CompareCode>;
	return <CompareParagraph>{text}</CompareParagraph>;
}

interface Sides {
	readonly left: EntryForm;
	readonly right: EntryForm;
	readonly leftLabel: string;
	readonly rightLabel: string;
}

export function EntryCompareScreen({ editor, mode }: { editor: EntryEditor; mode: CompareMode }) {
	const site = useSite();
	const t = useTranslator(entryCompareMessages);
	const ts = useTranslator(statusBarMessages);
	const router = useAdminRouter();
	const { entry, collection, conflict, recovery } = editor;

	const sides = useMemo<Sides | null>(() => {
		if (mode === "conflict" && conflict) {
			const time = conflict.server.changedAt ? clockTime(site, conflict.server.changedAt) : "";
			return {
				left: conflict.local,
				right: formFromEntry(site, conflict.server),
				leftLabel: t("side.mine"),
				rightLabel: t("side.server", { version: conflict.server.version, time }),
			};
		}
		if (mode === "draft" && recovery) {
			const server = recovery.server ?? entry;
			if (!server) return null;
			return {
				left: recovery.form,
				right: formFromEntry(site, server),
				leftLabel: t("side.draft", { stamp: stampOf(site, t, recovery.savedAt) }),
				rightLabel: server.changedAt
					? t("side.saved", { stamp: stampOf(site, t, server.changedAt) })
					: t("side.savedNoTime"),
			};
		}
		return null;
	}, [mode, conflict, recovery, entry, site, t]);

	const comparison = useMemo(
		() => (sides ? compareEntries(site, collection, sides.left, sides.right, { slug: t("slug") }) : null),
		[sides, site, collection, t],
	);
	if (!sides || !comparison || !entry) return null;

	const editHref = site.adminEntryEditHref(entry.id);
	const back = () => router.replace(editHref);
	const path = entryPath(site, {
		collection,
		locale: entry.locale,
		workingSlug: sides.left.slug || entry.workingSlug,
		publishedSlug: null,
	});
	const count = t("differences", { count: comparison.count });

	// Each answer ends the comparison: the editor comes back with the chosen version.
	const loadServer = async () => {
		const reloaded = await editor.reload();
		if (reloaded.ok) back();
		else toast.error(reloaded.error.message);
	};
	const saveMine = async () => {
		const saved = await editor.overwriteWithMine();
		if (saved.ok) back();
		else toast.error(saved.error.message);
	};
	const loadDraft = () => {
		editor.restoreRecovery();
		back();
	};
	const discardDraft = async () => {
		await editor.discardRecovery();
		back();
	};

	const side = (label: string, which: "left" | "right") => (
		<CompareSide
			label={label}
			properties={
				comparison.properties.length > 0
					? comparison.properties.map((property) => (
							<CompareProperty key={property.name} label={property.label} empty={t("empty")}>
								<Segments segments={which === "left" ? property.left : property.right} />
							</CompareProperty>
						))
					: undefined
			}
		>
			<CompareTitle>
				<Segments segments={which === "left" ? comparison.title.left : comparison.title.right} />
			</CompareTitle>
			<CompareBody>
				{(which === "left" ? comparison.left : comparison.right).map((block, index) => (
					// biome-ignore lint/suspicious/noArrayIndexKey: the blocks are in reading order and never reorder
					<Block key={index} block={block} />
				))}
			</CompareBody>
		</CompareSide>
	);

	return (
		<Stack gap={0} height="screen" overflow="clip" background="page">
			<Inline
				as="header"
				wrap
				gap={16}
				shrink={false}
				border="bottom"
				background="page"
				minHeight="header"
				paddingX={24}
			>
				<TextButton variant="quiet" render={<Link href={editHref} />}>
					<ChevronLeft aria-hidden />
					{t("back")}
				</TextButton>
				<Heading as="h1" variant="title">
					{mode === "conflict" ? t("heading.conflict") : t("heading.draft")}
				</Heading>
				{path && (
					<Text variant="meta" tone="faint">
						{path}
					</Text>
				)}
				<Inline grow justify="end" gap={16}>
					<Text variant="note" tone="subtle">
						{count}
					</Text>
					<Inline height="control-sm" paddingX={0}>
						<Separator orientation="vertical" aria-hidden />
					</Inline>
					{mode === "conflict" ? (
						<>
							<TextButton onClick={() => void loadServer()}>{t("loadServer")}</TextButton>
							<Button type="button" onClick={() => void saveMine()}>
								{t("saveMine")}
							</Button>
						</>
					) : (
						<>
							<TextButton onClick={() => void discardDraft()}>{t("discard")}</TextButton>
							<Button type="button" onClick={loadDraft}>
								{t("loadDraft")}
							</Button>
						</>
					)}
				</Inline>
			</Inline>
			<Stack gap={0} grow minHeight={0} overflow="y">
				<Compare>
					{side(sides.leftLabel, "left")}
					{side(sides.rightLabel, "right")}
				</Compare>
			</Stack>
			<StatusBar aria-label={ts("label")}>
				<StatusBarCell tone={mode === "conflict" ? "danger" : "warning"} dot={false} render={<span />}>
					{ts(mode === "conflict" ? "save.conflict" : "save.local-only")}
				</StatusBarCell>
				<StatusBarSpacer />
				<StatusBarCell end render={<span />}>
					{count}
				</StatusBarCell>
			</StatusBar>
		</Stack>
	);
}
