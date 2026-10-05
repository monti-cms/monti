"use client";

import { diffSources, type SourceChange, type StoredDocument } from "@monti-cms/core/client";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../../ui/dialog";
import { MdxPreview } from "./source-pane";
import { t } from "./translate";

const KIND_LABELS: Record<SourceChange["kind"], string> = {
	changed: t("sourceChange.changed"),
	added: t("sourceChange.added"),
	removed: t("sourceChange.removed"),
	moved: t("sourceChange.moved"),
};

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

function UnitView({ unit }: { unit: { kind: string; source: string } }) {
	return unit.kind === "header" ? (
		<p className="text-sm">{headerText(unit.source)}</p>
	) : (
		<MdxPreview mdx={unit.source} />
	);
}

function ChangeItem({ change }: { change: SourceChange }) {
	// A block that only moved reads the same before and now, so it is shown once.
	const unedited = change.kind === "moved" && !change.edited;
	const before = change.kind === "added" || unedited ? null : change.before;
	const after = change.kind === "removed" ? null : change.after;
	const label = change.kind === "moved" && change.edited ? t("sourceChange.movedChanged") : KIND_LABELS[change.kind];
	return (
		<li className="flex flex-col gap-2 rounded-md border p-3">
			<span className="w-fit rounded bg-cms-muted px-1.5 py-0.5 font-medium text-xs">{label}</span>
			<div className="grid gap-3 md:grid-cols-2">
				{before && (
					<div className="min-w-0">
						<p className="mb-1 text-cms-muted-foreground text-xs">{t("sourceChange.before")}</p>
						<UnitView unit={before} />
					</div>
				)}
				{after && (
					<div className="min-w-0">
						<p className="mb-1 text-cms-muted-foreground text-xs">{t("sourceChange.after")}</p>
						<UnitView unit={after} />
					</div>
				)}
			</div>
		</li>
	);
}

/** List of blocks that differ between the source the translator last confirmed and the current source. */
export function SourceChangeDialog({
	open,
	onOpenChange,
	before,
	after,
	beforeDoc,
	afterDoc,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	before: string;
	after: string;
	/** The stored documents of both versions. With both, blocks are compared by block id and moves are shown. */
	beforeDoc?: StoredDocument | null;
	afterDoc?: StoredDocument | null;
}) {
	const changes = open ? diffSources(before, after, { before: beforeDoc, after: afterDoc }) : null;
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
				<DialogHeader>
					<DialogTitle>{t("sourceChange.title")}</DialogTitle>
					<DialogDescription>{t("sourceChange.description")}</DialogDescription>
				</DialogHeader>
				{changes === null ? (
					<p className="text-cms-muted-foreground text-sm">{t("sourceChange.cantCompare")}</p>
				) : changes.length === 0 ? (
					<p className="text-cms-muted-foreground text-sm">{t("sourceChange.none")}</p>
				) : (
					<ol className="flex flex-col gap-3">
						{changes.map((change, index) => (
							// biome-ignore lint/suspicious/noArrayIndexKey: the change list's identity is document order
							<ChangeItem key={index} change={change} />
						))}
					</ol>
				)}
			</DialogContent>
		</Dialog>
	);
}
