"use client";

import { useSite, useTranslator } from "@monti-cms/core/site";
import { useId } from "react";
import type { ImportPreview, ImportPreviewEntry } from "../../api/import";
import { Badge } from "../../ui/badge";
import { Checkbox } from "../../ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../ui/table";
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
		<section className="flex flex-col gap-2" aria-label={t("collections.title")} data-testid="import-collections">
			<h4 className="font-medium text-monti-body">{t("collections.title")}</h4>
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
								<TableCell className="align-top">
									<div className="font-medium">{name}</div>
									<div className="text-monti-caption text-monti-muted">
										{t("collections.count", { count: collection.entries })}
									</div>
								</TableCell>
								<TableCell className="whitespace-normal">
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
										<p className="mt-1 text-monti-caption text-monti-muted">{collection.skipped.text}</p>
									)}
								</TableCell>
							</TableRow>
						);
					})}
				</TableBody>
			</Table>
		</section>
	);
}

function EntryStatus({ entry }: { entry: ImportPreviewEntry }) {
	const t = useTranslator(importMessages);
	if (!entry.skipped) {
		return (
			<div className="flex flex-col gap-1">
				<Badge variant="success">{t("entries.willImport")}</Badge>
				{entry.notes.map((note) => (
					<span key={note.code} className="text-monti-caption text-monti-muted">
						{note.text}
					</span>
				))}
			</div>
		);
	}
	const conflict = entry.skipped.code === "slug_exists";
	return (
		<div className="flex flex-col gap-1">
			<Badge variant={conflict ? "warning" : "secondary"}>
				{conflict ? t("entries.conflict") : t("entries.skipped")}
			</Badge>
			<span className="text-monti-caption text-monti-muted">{entry.skipped.text}</span>
		</div>
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
		<section className="flex flex-col gap-2" aria-label={t("entries.title")} data-testid="import-entries">
			<h4 className="font-medium text-monti-body">{t("entries.title")}</h4>
			<div className="max-h-96 overflow-y-auto rounded-md border">
				<Table containerClassName="overflow-visible">
					<TableHeader className="sticky top-0 bg-monti-surface">
						<TableRow>
							<TableHead>{t("entries.title.column")}</TableHead>
							<TableHead>{t("entries.locale")}</TableHead>
							<TableHead>{t("entries.collection")}</TableHead>
							<TableHead>{t("entries.result")}</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{rows.map((entry) => (
							<TableRow key={entry.key} data-testid="import-entry" data-status={entry.skipped ? "skipped" : "import"}>
								<TableCell className="max-w-64 whitespace-normal align-top">
									<div className="flex flex-wrap items-center gap-x-2 gap-y-1">
										<span className="break-words font-medium">{entry.title ?? t("entries.noTitle")}</span>
										{entry.isTranslation && <Badge variant="outline">{t("entries.translation")}</Badge>}
									</div>
									<div className="break-all font-mono text-monti-caption text-monti-muted">{entry.slug ?? "—"}</div>
									{entry.body !== null && (
										<div className="text-monti-caption text-monti-muted">
											{entry.body.kind === "text" ? t("body.text", { format: entry.body.format }) : t("body.json")}
										</div>
									)}
								</TableCell>
								<TableCell className="align-top">{site.localeLabel(entry.locale)}</TableCell>
								<TableCell className="align-top">{placeOf(entry)}</TableCell>
								<TableCell className="whitespace-normal align-top">
									<EntryStatus entry={entry} />
								</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
			</div>
			{preview.entries.length > ROW_LIMIT && (
				<p className="text-monti-caption text-monti-muted">
					{t("entries.more", { count: preview.entries.length - ROW_LIMIT })}
				</p>
			)}
		</section>
	);
}

/** What the import leaves behind or cannot keep, in plain lines: values not read, images outside the media library, links to entries that are not imported. */
function Leftovers({ preview }: { preview: ImportPreview }) {
	const t = useTranslator(importMessages);
	const { counts } = preview;
	return (
		<section className="flex flex-col gap-2" aria-label={t("fields.title")} data-testid="import-leftovers">
			<h4 className="font-medium text-monti-body">{t("fields.title")}</h4>
			<ul className="flex flex-col gap-2 text-monti-body text-monti-muted">
				<li>{t("fields.only")}</li>
				{preview.kind === "export" && <li>{t("fields.shared")}</li>}
				{preview.fieldsNotImported.map((item) => (
					<li key={item.collection} data-testid="import-fields">
						{t("fields.line", {
							collection: item.collection === "" ? t("collections.top") : item.collection,
							fields: item.fields.join(", "),
						})}
						{item.required.length > 0 && (
							<span className="block text-monti-caption">
								{t("fields.required", { collection: item.target, fields: item.required.join(", ") })}
							</span>
						)}
					</li>
				))}
				{counts.outsideImages > 0 && (
					<li data-testid="import-images">{t("images.line", { count: counts.outsideImages })}</li>
				)}
				{counts.keptLinks > 0 && <li data-testid="import-links">{t("links.line", { count: counts.keptLinks })}</li>}
			</ul>
		</section>
	);
}

/** The archive as the server reads it: the counts, where each collection goes, every entry and what happens to it, and what is left behind. */
export function PreviewView({ preview, form }: { preview: ImportPreview; form: ImportForm }) {
	const t = useTranslator(importMessages);
	const publishId = useId();
	const { counts } = preview;
	return (
		<div className="flex flex-col gap-6" data-testid="import-preview">
			<p className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-monti-body" data-testid="import-summary">
				<span className="text-monti-title">{t("summary.found", { count: counts.entries })}</span>
				<span className="text-monti-muted">
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
				</span>
			</p>
			<CollectionTargets preview={preview} form={form} />
			<EntryRows preview={preview} />
			<Leftovers preview={preview} />
			{counts.publishable > 0 && (
				<label htmlFor={publishId} className="flex cursor-pointer items-start gap-3 text-monti-body">
					<Checkbox
						id={publishId}
						checked={form.publish}
						onCheckedChange={(checked) => form.setPublish(checked === true)}
						className="mt-0.5"
					/>
					<span className="flex flex-col gap-0.5">
						<span className="font-medium">{t("publish.label")}</span>
						<span className="text-monti-caption text-monti-muted">
							{t("publish.hint", { count: counts.publishable })}
						</span>
					</span>
				</label>
			)}
		</div>
	);
}
