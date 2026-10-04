"use client";

import { diffSources, type SourceChange } from "@monti-cms/core/client";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../../ui/dialog";
import { MdxPreview } from "./source-pane";
import { t } from "./translate";

const KIND_LABELS: Record<SourceChange["kind"], string> = {
	changed: t("sourceChange.changed"),
	added: t("sourceChange.added"),
	removed: t("sourceChange.removed"),
};

/** 머리 줄 조각(`{"title":..}`·`{"labels":[..]}`)의 글자. */
const headerText = (source: string) => {
	try {
		const value = JSON.parse(source) as { title?: unknown; labels?: unknown };
		if (typeof value.title === "string") return value.title;
		if (Array.isArray(value.labels)) return value.labels.join(" · ");
	} catch {
		// 깨진 조각은 그대로 보인다.
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
	const before = change.kind === "added" ? null : change.before;
	const after = change.kind === "removed" ? null : change.after;
	return (
		<li className="flex flex-col gap-2 rounded-md border p-3">
			<span className="w-fit rounded bg-cms-muted px-1.5 py-0.5 font-medium text-xs">{KIND_LABELS[change.kind]}</span>
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

/** 번역자가 마지막으로 확인한 원문과 지금 원문의 바뀐 블록 목록. */
export function SourceChangeDialog({
	open,
	onOpenChange,
	before,
	after,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	before: string;
	after: string;
}) {
	const changes = open ? diffSources(before, after) : null;
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
							// biome-ignore lint/suspicious/noArrayIndexKey: 변경 목록은 문서 순서가 곧 정체성이다
							<ChangeItem key={index} change={change} />
						))}
					</ol>
				)}
			</DialogContent>
		</Dialog>
	);
}
