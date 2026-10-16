"use client";

import type { ChangeImpact } from "@monti-cms/core/internal/schema-change";
import type { SchemaDecision } from "@monti-cms/core/internal/schema-edit";
import type { ConfigIssue } from "@monti-cms/core/site";
import { useSite, useTranslator } from "@monti-cms/core/site";
import { CheckCircle2, Info, TriangleAlert } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { CmsApiError, errorText } from "../../api/client";
import {
	type EditRequest,
	previewSchema,
	type SavedSchema,
	type SchemaEditPreview,
	type SuggestedTransform,
	saveSchema,
} from "../../api/schema";
import { useCmsMutation } from "../../api/use-cms-mutation";
import { commonMessages } from "../../lib/common.messages";
import { AdminLink } from "../../router";
import { Alert, AlertDescription, AlertTitle } from "../../ui/alert";
import { Badge } from "../../ui/badge";
import { Button } from "../../ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../../ui/dialog";
import { Input } from "../../ui/input";
import { Skeleton } from "../../ui/skeleton";
import { entryHref } from "../shared/entry-href";
import { describeChange, describeNoTransform, describeTransform } from "./change-text";
import { IssueList } from "./controls";
import { reloadPage } from "./reload";
import { schemaReviewMessages } from "./review.messages";
import type { Rename, SettingChange } from "./schema-model";

type Picks = Record<string, SuggestedTransform | null>;

/** The request of the screen's edit with the picks made so far; `undefined` picks leave the choice to the server's defaults. */
const requestOf = (draft: unknown, renames: readonly Rename[], picks: Picks | undefined): EditRequest => ({
	schema: draft,
	transforms: picks ? Object.values(picks).filter((pick): pick is SuggestedTransform => pick !== null) : undefined,
	renames,
});

const sameTransform = (a: SuggestedTransform | null, b: SuggestedTransform) =>
	a !== null &&
	a.op === b.op &&
	JSON.stringify({ ...a, value: undefined }) === JSON.stringify({ ...b, value: undefined });

/** The choices of one change the data can follow in more than one way, each with what it does; "keep" is always there. */
function Decision({
	decision,
	picked,
	onPick,
}: {
	decision: SchemaDecision;
	picked: SuggestedTransform | null;
	onPick: (pick: SuggestedTransform | null) => void;
}) {
	const t = useTranslator(schemaReviewMessages);
	const site = useSite();
	const name = `decision-${decision.key}`;
	const freeText =
		decision.suggestions.length === 1 &&
		decision.suggestions[0]?.op === "setDefault" &&
		decision.suggestions[0].value === "";
	return (
		<fieldset className="flex flex-col gap-1.5 rounded-lg border p-3" data-testid={`decision-${decision.key}`}>
			<legend className="px-1 font-medium text-sm">{describeChange(decision.change, t)}</legend>
			<p className="text-cms-muted-foreground text-xs">
				{decision.entries === 0 ? t("review.noEntries") : t("review.entriesCount", { count: decision.entries })}
			</p>
			<label className="flex items-start gap-2 text-sm">
				<input type="radio" name={name} checked={picked === null} onChange={() => onPick(null)} className="mt-1" />
				<span>{describeNoTransform(decision.change, t)}</span>
			</label>
			{decision.suggestions.map((suggestion) => {
				const checked = sameTransform(picked, suggestion);
				return (
					<label key={JSON.stringify(suggestion)} className="flex flex-col gap-1 text-sm">
						<span className="flex items-start gap-2">
							<input type="radio" name={name} checked={checked} onChange={() => onPick(suggestion)} className="mt-1" />
							<span>
								{describeTransform(suggestion, t)}
								{suggestion.op === "dropField" && (
									<span className="ml-1 text-cms-destructive text-xs">{t("transform.dropWarning")}</span>
								)}
							</span>
						</span>
						{checked && freeText && picked?.op === "setDefault" && (
							<Input
								aria-label={t("transform.defaultValue")}
								className="ml-6 w-auto"
								value={picked.value}
								onChange={(event) => onPick({ ...picked, value: event.target.value })}
							/>
						)}
					</label>
				);
			})}
			{decision.sample.length > 0 && <Sample sample={decision.sample} entries={decision.entries} site={site} />}
		</fieldset>
	);
}

function Sample({
	sample,
	entries,
	site,
}: {
	sample: ChangeImpact["sample"];
	entries: number;
	site: ReturnType<typeof useSite>;
}) {
	const t = useTranslator(schemaReviewMessages);
	return (
		<div className="text-xs">
			<span className="text-cms-muted-foreground">{t("review.sample")} </span>
			<ul className="inline">
				{sample.map((entry, index) => (
					<li key={entry.id} className="inline">
						{index > 0 && ", "}
						<AdminLink
							href={entryHref(site, entry.collection, entry.id)}
							className="underline underline-offset-2"
							target="_blank"
						>
							{entry.title ?? entry.id.slice(0, 8)}
						</AdminLink>
						<span className="text-cms-muted-foreground">
							{" "}
							({entry.collection}, {entry.locale}, {entry.status})
						</span>
					</li>
				))}
			</ul>
			{entries > sample.length && (
				<span className="text-cms-muted-foreground"> {t("review.more", { count: entries - sample.length })}</span>
			)}
		</div>
	);
}

function Impact({ impact }: { impact: ChangeImpact }) {
	const t = useTranslator(schemaReviewMessages);
	const site = useSite();
	return (
		<li className="flex flex-col gap-1 rounded-md border px-3 py-2" data-testid={`impact-${impact.key}`}>
			<div className="flex flex-wrap items-center gap-2">
				<span className="text-sm">{describeChange(impact.change, t)}</span>
				{impact.entries > 0 && (
					<Badge variant={impact.consequence === "deleted" ? "destructive" : "secondary"}>
						{t("review.entriesCount", { count: impact.entries })}
					</Badge>
				)}
			</div>
			{impact.entries > 0 && (
				<p className="text-cms-muted-foreground text-xs">{t(`consequence.${impact.consequence}`)}</p>
			)}
			{!impact.checked && <p className="text-cms-muted-foreground text-xs">{t("review.notChecked")}</p>}
			{impact.sample.length > 0 && <Sample sample={impact.sample} entries={impact.entries} site={site} />}
		</li>
	);
}

/** A setting's value as one short piece of text. */
const settingText = (value: unknown, unset: string): string =>
	value === undefined ? unset : typeof value === "string" ? `"${value}"` : JSON.stringify(value);

export interface ReviewDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	draft: unknown;
	renames: readonly Rename[];
	/** The site and admin settings that differ from the file, which the entries do not care about but the writer should still see. */
	settings?: readonly SettingChange[];
	baseHash: string;
	/** The problems of the last check, for the screen to mark. */
	onIssues: (issues: readonly ConfigIssue[]) => void;
	/** The file was saved (and applied). The screen reloads so everything shows the new schema. */
	onSaved: (saved: SavedSchema) => void;
	/** The file was saved but applying it to the database failed. */
	onApplyFailed: () => void;
}

/**
 * Shows what saving would do and saves it. Opening it checks the edit on the server (no write): the problems with JSON paths, the diff, the entries each change
 * touches with a sample linking to them, and a choice of data transform for every change that has more than one way to treat the stored values. Saving writes the file,
 * the types and the dev database; the screen then reloads.
 */
export function ReviewDialog({
	open,
	onOpenChange,
	draft,
	renames,
	settings = [],
	baseHash,
	onIssues,
	onSaved,
	onApplyFailed,
}: ReviewDialogProps) {
	const t = useTranslator(schemaReviewMessages);
	const tc = useTranslator(commonMessages);
	const site = useSite();
	const [preview, setPreview] = useState<SchemaEditPreview | null>(null);
	const [picks, setPicks] = useState<Picks | undefined>(undefined);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [saveError, setSaveError] = useState<{ message: string; conflict?: boolean; applyFailed?: boolean } | null>(
		null,
	);
	const skip = useRef(false);

	const request = (current: Picks | undefined): EditRequest => ({
		schema: draft,
		transforms: current
			? Object.values(current).filter((pick): pick is SuggestedTransform => pick !== null)
			: undefined,
		renames,
	});

	useEffect(() => {
		if (!open) {
			setPreview(null);
			setPicks(undefined);
			setError(null);
			setSaveError(null);
			return;
		}
		if (skip.current) {
			skip.current = false;
			return;
		}
		const controller = new AbortController();
		// A pick that is being typed (a default value) is checked a moment after the last key.
		const timer = setTimeout(
			() => {
				setLoading(true);
				previewSchema(site, requestOf(draft, renames, picks), controller.signal)
					.then((result) => {
						setPreview(result);
						setError(null);
						onIssues(result.issues);
						if (!picks) {
							skip.current = true;
							setPicks(Object.fromEntries(result.decisions.map((decision) => [decision.key, decision.chosen])));
						}
					})
					.catch((reason: unknown) => {
						if ((reason as { name?: string })?.name === "AbortError") return;
						setError(errorText(site, reason, t("review.loadFailed")));
					})
					.finally(() => setLoading(false));
			},
			picks ? 250 : 0,
		);
		return () => {
			clearTimeout(timer);
			controller.abort();
		};
	}, [open, draft, renames, picks, site, onIssues, t]);

	const saveMutation = useCmsMutation({
		// The impacts this dialog showed are the ones the writer reviewed; the server refuses a lossy change it was not told was seen.
		fn: (current: Picks | undefined, { site }) =>
			saveSchema(site, {
				...request(current),
				baseHash,
				acknowledged: (preview?.impacts ?? []).map((impact) => impact.key),
			}),
		failure: t("save.failed"),
		// Each failure has its own text and effect in the dialog.
		inline: true,
		onSuccess: (result) => {
			if (result.saved) onSaved(result);
			else onOpenChange(false);
		},
		onError: (reason) => {
			if (reason instanceof CmsApiError) {
				if (reason.code === "schema_conflict") setSaveError({ message: t("save.conflict"), conflict: true });
				else if (reason.code === "schema_apply_failed") {
					setSaveError({ message: t("save.applyFailed", { message: reason.message }), applyFailed: true });
					onApplyFailed();
				} else {
					const issues = Array.isArray(reason.body.issues) ? (reason.body.issues as ConfigIssue[]) : [];
					if (reason.code === "invalid_schema") onIssues(issues);
					setSaveError({ message: reason.message });
				}
			} else setSaveError({ message: errorText(site, reason, t("save.failed")) });
		},
	});
	const saving = saveMutation.isPending;
	const save = () => {
		setSaveError(null);
		saveMutation.mutate(picks);
	};

	const problems = preview?.problems ?? [];
	const ready = preview?.valid && problems.length === 0 && preview.changed && !loading && !saving;
	const dataChanges = (preview?.impacts ?? []).length;

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="flex max-h-[85vh] w-[min(44rem,calc(100%-2rem))] max-w-none flex-col gap-4 sm:max-w-none">
				<DialogHeader>
					<DialogTitle>{t("review.title")}</DialogTitle>
					<DialogDescription>{t("review.description")}</DialogDescription>
				</DialogHeader>
				<div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto pr-1" data-testid="review-body">
					{error && (
						<Alert variant="destructive" layout="stack">
							<AlertDescription>{error}</AlertDescription>
						</Alert>
					)}
					{loading && !preview && <Skeleton className="h-24 w-full" />}
					{preview && !preview.valid && (
						<Alert variant="destructive" layout="stack">
							<AlertTitle>{t("review.invalid")}</AlertTitle>
							<AlertDescription>
								<IssueList issues={preview.issues} />
							</AlertDescription>
						</Alert>
					)}
					{problems.length > 0 && (
						<Alert variant="destructive" layout="stack">
							<AlertTitle>{t("review.problems")}</AlertTitle>
							<AlertDescription>
								<ul className="list-disc pl-4">
									{problems.map((problem) => (
										<li key={`${problem.id}:${problem.message}`}>{problem.message}</li>
									))}
								</ul>
							</AlertDescription>
						</Alert>
					)}
					{preview?.valid && (
						<>
							<div
								className="flex items-center gap-2.5 rounded-lg border border-cms-border bg-cms-muted/40 px-3.5 py-2.5 text-sm"
								data-testid="review-summary"
							>
								{dataChanges === 0 ? (
									<CheckCircle2 className="size-4 shrink-0 text-cms-primary" aria-hidden />
								) : (
									<Info className="size-4 shrink-0 text-cms-muted-foreground" aria-hidden />
								)}
								<p>
									{preview.changed
										? t("review.summary", { count: dataChanges, from: preview.currentVersion, to: preview.nextVersion })
										: t("review.unchanged")}
								</p>
							</div>
							{preview.baseline === "file" && (
								<p className="text-cms-muted-foreground text-xs">{t("review.baselineFile")}</p>
							)}
							{preview.decisions.length > 0 && (
								<section className="flex flex-col gap-2" aria-label={t("review.decisions")}>
									<h3 className="font-medium text-sm">{t("review.decisions")}</h3>
									<p className="text-cms-muted-foreground text-xs">{t("review.decisionsHint")}</p>
									{preview.decisions.map((decision) => (
										<Decision
											key={decision.key}
											decision={decision}
											picked={picks?.[decision.key] ?? null}
											onPick={(pick) => setPicks((current) => ({ ...current, [decision.key]: pick }))}
										/>
									))}
								</section>
							)}
							{settings.length > 0 && (
								<section
									className="flex flex-col gap-2"
									aria-label={t("review.settings")}
									data-testid="review-settings"
								>
									<h3 className="font-medium text-sm">{t("review.settings")}</h3>
									<ul className="flex flex-col gap-1.5">
										{settings.map((setting) => (
											<li
												key={setting.path}
												className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-cms-border bg-cms-muted/20 px-3 py-2 font-mono text-xs"
											>
												<div>
													<code className="font-semibold text-cms-foreground">{setting.path}</code>:{" "}
												</div>
												<div className="flex items-center gap-2">
													<span className="text-cms-muted-foreground line-through decoration-cms-muted-foreground/60">
														{settingText(setting.from, t("review.unset"))}
													</span>
													{" -> "}
													<span className="rounded bg-cms-primary/10 px-1.5 py-0.5 font-medium text-cms-primary">
														{settingText(setting.to, t("review.unset"))}
													</span>
												</div>
											</li>
										))}
									</ul>
								</section>
							)}
							{preview.impacts.length > 0 && (
								<section className="flex flex-col gap-2" aria-label={t("review.changes")}>
									<h3 className="font-medium text-sm">{t("review.changes")}</h3>
									<ul className="flex flex-col gap-1.5">
										{preview.impacts.map((impact) => (
											<Impact key={impact.key} impact={impact} />
										))}
									</ul>
								</section>
							)}
							{preview.transforms.length > 0 && (
								<p className="text-cms-muted-foreground text-xs">
									{t("review.transforms", { ids: preview.transforms.map((item) => item.id).join(", ") })}
								</p>
							)}
						</>
					)}
					{saveError && (
						<Alert variant="destructive" layout="stack">
							<TriangleAlert aria-hidden />
							<AlertDescription>{saveError.message}</AlertDescription>
						</Alert>
					)}
				</div>
				<DialogFooter>
					{saveError?.conflict || saveError?.applyFailed ? (
						<Button type="button" onClick={reloadPage}>
							{t("save.reload")}
						</Button>
					) : (
						<>
							<Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
								{tc("cancel")}
							</Button>
							<Button type="button" disabled={!ready} onClick={() => void save()}>
								{saving ? tc("saving") : t("review.save")}
							</Button>
						</>
					)}
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
