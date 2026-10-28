"use client";

import { useSite, useTranslator } from "@monti-cms/core/site";
import {
	Box,
	Checkbox,
	Heading,
	Inline,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
	Stack,
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
	Text,
} from "@monti-cms/ui";
import { useId } from "react";
import type { ImportPreview, ImportPreviewEntry } from "../../api/import";
import { importMessages } from "./messages";
import type { ImportForm } from "./use-import-entries";

/** The most entry rows the preview lists; the counts above them cover all. */
const ROW_LIMIT = 200;
/** Value of the "skip" choice of a collection's select. */
const SKIP = "__skip__";

/** Where each collection of the archive goes: a select of the site's document collections, or skip. */
function CollectionTargets({ preview, form }: { preview: ImportPreview; form: ImportForm }) {
	const t = useTranslator(importMessages);
	const items = [
		{ value: SKIP, label: t("collections.skip") },
		...preview.targets.map((target) => ({ value: target.name, label: target.label })),
	];
	return (
		<Stack as="section" gap={8} aria-label={t("collections.title")}>
			<Heading as="h4" variant="label">
				{t("collections.title")}
			</Heading>
			<Table>
				<TableHeader>
					<TableRow>
						<TableHead>{t("collections.archive")}</TableHead>
						<TableHead>{t("collections.target")}</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{preview.collections.map((collection) => {
						const name = collection.name === "" ? t("collections.top") : collection.name;
						return (
							<TableRow key={collection.name}>
								<TableCell valign="top">
									<Text as="div" weight="medium">
										{name}
									</Text>
									<Text as="div" variant="caption" tone="muted">
										{t("collections.count", { count: collection.entries })}
									</Text>
								</TableCell>
								<TableCell wrap>
									<Select
										value={collection.target ?? SKIP}
										items={items}
										onValueChange={(value) => form.setTarget(collection.name, value && value !== SKIP ? value : null)}
									>
										<SelectTrigger size="sm" aria-label={`${t("collections.target")}: ${name}`}>
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											{items.map((item) => (
												<SelectItem key={item.value} value={item.value}>
													{item.label}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
									{collection.skipped && (
										<Box paddingTop={4}>
											<Text as="p" variant="caption" tone="muted">
												{collection.skipped.text}
											</Text>
										</Box>
									)}
								</TableCell>
							</TableRow>
						);
					})}
				</TableBody>
			</Table>
		</Stack>
	);
}

function EntryStatus({ entry }: { entry: ImportPreviewEntry }) {
	const t = useTranslator(importMessages);
	if (!entry.skipped) {
		return (
			<Stack gap={4}>
				<Text variant="label" tone="success">
					{t("entries.willImport")}
				</Text>
				{entry.notes.map((note) => (
					<Text key={note.code} variant="caption" tone="muted">
						{note.text}
					</Text>
				))}
			</Stack>
		);
	}
	const conflict = entry.skipped.code === "slug_exists";
	return (
		<Stack gap={4}>
			<Text variant="label" tone={conflict ? "warning" : "subtle"}>
				{conflict ? t("entries.conflict") : t("entries.skipped")}
			</Text>
			<Text variant="caption" tone="muted">
				{entry.skipped.text}
			</Text>
		</Stack>
	);
}

function EntryRows({ preview }: { preview: ImportPreview }) {
	const t = useTranslator(importMessages);
	const site = useSite();
	const rows = preview.entries.slice(0, ROW_LIMIT);
	// The collection an entry goes to; when it goes nowhere, the collection it came from.
	const placeOf = (entry: ImportPreviewEntry) =>
		entry.target === null
			? entry.collection === ""
				? t("collections.top")
				: entry.collection
			: (preview.targets.find((target) => target.name === entry.target)?.label ?? entry.target);
	return (
		<Stack as="section" gap={8} aria-label={t("entries.title")}>
			<Heading as="h4" variant="label">
				{t("entries.title")}
			</Heading>
			<Box radius="md" border="all" maxHeight="list" overflow="y">
				<Table container="none" stickyHeader>
					<TableHeader>
						<TableRow>
							<TableHead>{t("entries.title.column")}</TableHead>
							<TableHead>{t("entries.locale")}</TableHead>
							<TableHead>{t("entries.collection")}</TableHead>
							<TableHead>{t("entries.result")}</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{rows.map((entry) => (
							<TableRow key={entry.key}>
								<TableCell valign="top" wrap>
									<Inline gap={8} wrap>
										<Text weight="medium">{entry.title ?? t("entries.noTitle")}</Text>
										{entry.isTranslation && (
											<Text variant="meta" tone="subtle">
												{t("entries.translation")}
											</Text>
										)}
									</Inline>
									<Text as="div" variant="caption" tone="muted" mono>
										{entry.slug ?? "—"}
									</Text>
									{entry.body !== null && (
										<Text as="div" variant="caption" tone="muted">
											{entry.body.kind === "text" ? t("body.text", { format: entry.body.format }) : t("body.json")}
										</Text>
									)}
								</TableCell>
								<TableCell valign="top">{site.localeLabel(entry.locale)}</TableCell>
								<TableCell valign="top">{placeOf(entry)}</TableCell>
								<TableCell valign="top">
									<EntryStatus entry={entry} />
								</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
			</Box>
			{preview.entries.length > ROW_LIMIT && (
				<Text as="p" variant="caption" tone="muted">
					{t("entries.more", { count: preview.entries.length - ROW_LIMIT })}
				</Text>
			)}
		</Stack>
	);
}

/** What the import leaves behind or cannot keep, in plain lines: values not read, images outside the media library, links to entries that are not imported. */
function Leftovers({ preview }: { preview: ImportPreview }) {
	const t = useTranslator(importMessages);
	const { counts } = preview;
	return (
		<Stack as="section" gap={8} aria-label={t("fields.title")}>
			<Heading as="h4" variant="label">
				{t("fields.title")}
			</Heading>
			<Stack as="ul" gap={8}>
				<Text as="li" tone="muted">
					{t("fields.only")}
				</Text>
				{preview.kind === "export" && (
					<Text as="li" tone="muted">
						{t("fields.shared")}
					</Text>
				)}
				{preview.fieldsNotImported.map((item) => (
					<Text as="li" tone="muted" key={item.collection}>
						{t("fields.line", {
							collection: item.collection === "" ? t("collections.top") : item.collection,
							fields: item.fields.join(", "),
						})}
						{item.required.length > 0 && (
							<Text as="div" variant="caption">
								{t("fields.required", { collection: item.target, fields: item.required.join(", ") })}
							</Text>
						)}
					</Text>
				))}
				{counts.outsideImages > 0 && (
					<Text as="li" tone="muted">
						{t("images.line", { count: counts.outsideImages })}
					</Text>
				)}
				{counts.keptLinks > 0 && (
					<Text as="li" tone="muted">
						{t("links.line", { count: counts.keptLinks })}
					</Text>
				)}
			</Stack>
		</Stack>
	);
}

/** The archive as the server reads it: the counts, where each collection goes, every entry and what happens to it, and what is left behind. */
export function PreviewView({ preview, form }: { preview: ImportPreview; form: ImportForm }) {
	const t = useTranslator(importMessages);
	const publishId = useId();
	const { counts } = preview;
	return (
		<Stack gap={24}>
			<Inline gap={12} wrap align="baseline">
				<Text variant="title">{t("summary.found", { count: counts.entries })}</Text>
				<Text tone="muted">
					{[
						t("summary.import", { count: counts.imported }),
						t("summary.skipped", { count: counts.skipped }),
						counts.conflicts > 0 ? t("summary.conflicts", { count: counts.conflicts }) : null,
						preview.kind === "markdown" && counts.otherFiles > 0
							? t("summary.files", { count: counts.otherFiles })
							: null,
					]
						.filter(Boolean)
						.join(" · ")}
				</Text>
			</Inline>
			<CollectionTargets preview={preview} form={form} />
			<EntryRows preview={preview} />
			<Leftovers preview={preview} />
			{counts.publishable > 0 && (
				<Box as="label" htmlFor={publishId}>
					<Inline gap={12} align="start">
						<Checkbox
							id={publishId}
							checked={form.publish}
							onCheckedChange={(checked) => form.setPublish(checked === true)}
						/>
						<Stack gap={2}>
							<Text weight="medium">{t("publish.label")}</Text>
							<Text variant="caption" tone="muted">
								{t("publish.hint", { count: counts.publishable })}
							</Text>
						</Stack>
					</Inline>
				</Box>
			)}
		</Stack>
	);
}
