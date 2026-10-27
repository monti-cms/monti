"use client";

import type { ChangeImpact } from "@monti-cms/core/internal/schema-change";
import type { SchemaDecision } from "@monti-cms/core/internal/schema-edit";
import type { ConfigIssue } from "@monti-cms/core/site";
import { useSite, useTranslator } from "@monti-cms/core/site";
import {
	Badge,
	Banner,
	Box,
	Button,
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	Heading,
	Inline,
	Input,
	List,
	ListItem,
	Skeleton,
	Stack,
	Text,
	TextButton,
} from "@monti-cms/ui";
import { CheckCircle2, Info } from "lucide-react";
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
		<Stack
			role="group"
			aria-labelledby={`${name}-title`}
			gap={8}
			border="all"
			radius="lg"
			padding={12}
			data-testid={`decision-${decision.key}`}
		>
			<Text as="div" id={`${name}-title`} weight="medium">
				{describeChange(decision.change, t)}
			</Text>
			<Text as="p" variant="caption" tone="muted">
				{decision.entries === 0 ? t("review.noEntries") : t("review.entriesCount", { count: decision.entries })}
			</Text>
			<Inline as="label" align="start" gap={8}>
				<input type="radio" name={name} checked={picked === null} onChange={() => onPick(null)} />
				<Text>{describeNoTransform(decision.change, t)}</Text>
			</Inline>
			{decision.suggestions.map((suggestion) => {
				const checked = sameTransform(picked, suggestion);
				return (
					<Stack as="label" key={JSON.stringify(suggestion)} gap={4}>
						<Inline as="span" align="start" gap={8}>
							<input type="radio" name={name} checked={checked} onChange={() => onPick(suggestion)} />
							<Text>
								{describeTransform(suggestion, t)}
								{suggestion.op === "dropField" && (
									<>
										{" "}
										<Text variant="caption" tone="danger">
											{t("transform.dropWarning")}
										</Text>
									</>
								)}
							</Text>
						</Inline>
						{checked && freeText && picked?.op === "setDefault" && (
							<Box paddingX={24}>
								<Input
									aria-label={t("transform.defaultValue")}
									value={picked.value}
									onChange={(event) => onPick({ ...picked, value: event.target.value })}
								/>
							</Box>
						)}
					</Stack>
				);
			})}
			{decision.sample.length > 0 && <Sample sample={decision.sample} entries={decision.entries} site={site} />}
		</Stack>
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
		<Inline wrap align="baseline" gap={4}>
			<Text variant="caption" tone="muted">
				{t("review.sample")}
			</Text>
			<Inline as="ul" wrap align="baseline" gap={0}>
				{sample.map((entry, index) => (
					<Text as="li" variant="caption" key={entry.id}>
						{index > 0 && ", "}
						<TextButton
							variant="underline"
							render={<AdminLink href={entryHref(site, entry.collection, entry.id)} target="_blank" />}
						>
							{entry.title ?? entry.id.slice(0, 8)}
						</TextButton>
						<Text tone="muted">
							{" "}
							({entry.collection}, {entry.locale}, {entry.status})
						</Text>
					</Text>
				))}
			</Inline>
			{entries > sample.length && (
				<Text variant="caption" tone="muted">
					{t("review.more", { count: entries - sample.length })}
				</Text>
			)}
		</Inline>
	);
}

function Impact({ impact }: { impact: ChangeImpact }) {
	const t = useTranslator(schemaReviewMessages);
	const site = useSite();
	return (
		<Stack as="li" gap={4} border="all" radius="md" paddingX={12} paddingY={8} data-testid={`impact-${impact.key}`}>
			<Inline wrap gap={8}>
				<Text>{describeChange(impact.change, t)}</Text>
				{impact.entries > 0 && (
					<Badge variant={impact.consequence === "deleted" ? "danger" : "secondary"}>
						{t("review.entriesCount", { count: impact.entries })}
					</Badge>
				)}
			</Inline>
			{impact.entries > 0 && (
				<Text as="p" variant="caption" tone="muted">
					{t(`consequence.${impact.consequence}`)}
				</Text>
			)}
			{!impact.checked && (
				<Text as="p" variant="caption" tone="muted">
					{t("review.notChecked")}
				</Text>
			)}
			{impact.sample.length > 0 && <Sample sample={impact.sample} entries={impact.entries} site={site} />}
		</Stack>
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
			<DialogContent size="xl">
				<DialogHeader>
					<DialogTitle>{t("review.title")}</DialogTitle>
					<DialogDescription>{t("review.description")}</DialogDescription>
				</DialogHeader>
				<Stack gap={16} maxHeight="half" overflow="y" data-testid="review-body">
					{error && <Banner role="alert" title={error} />}
					{loading && !preview && <Skeleton shape="block" />}
					{preview && !preview.valid && (
						<Stack gap={8}>
							<Banner role="alert" title={t("review.invalid")} />
							<IssueList issues={preview.issues} />
						</Stack>
					)}
					{problems.length > 0 && (
						<Stack gap={8}>
							<Banner role="alert" title={t("review.problems")} />
							<List>
								{problems.map((problem) => (
									<ListItem key={`${problem.id}:${problem.message}`}>{problem.message}</ListItem>
								))}
							</List>
						</Stack>
					)}
					{preview?.valid && (
						<>
							<Inline
								gap={8}
								border="all"
								radius="lg"
								background="tool"
								paddingX={12}
								paddingY={8}
								data-testid="review-summary"
							>
								{dataChanges === 0 ? (
									<Text as="span">
										<CheckCircle2 size={16} aria-hidden />
									</Text>
								) : (
									<Text as="span" tone="muted">
										<Info size={16} aria-hidden />
									</Text>
								)}
								<Text as="p">
									{preview.changed ? t("review.summary", { count: dataChanges }) : t("review.unchanged")}
								</Text>
							</Inline>
							{preview.baseline === "file" && (
								<Text as="p" variant="caption" tone="muted">
									{t("review.baselineFile")}
								</Text>
							)}
							{preview.decisions.length > 0 && (
								<Stack as="section" gap={8} aria-label={t("review.decisions")}>
									<Heading as="h3" variant="label">
										{t("review.decisions")}
									</Heading>
									<Text as="p" variant="caption" tone="muted">
										{t("review.decisionsHint")}
									</Text>
									{preview.decisions.map((decision) => (
										<Decision
											key={decision.key}
											decision={decision}
											picked={picks?.[decision.key] ?? null}
											onPick={(pick) => setPicks((current) => ({ ...current, [decision.key]: pick }))}
										/>
									))}
								</Stack>
							)}
							{settings.length > 0 && (
								<Stack as="section" gap={8} aria-label={t("review.settings")} data-testid="review-settings">
									<Heading as="h3" variant="label">
										{t("review.settings")}
									</Heading>
									<Stack as="ul" gap={8}>
										{settings.map((setting) => (
											<Inline
												as="li"
												key={setting.path}
												wrap
												justify="between"
												gap={8}
												border="all"
												radius="md"
												background="tool"
												paddingX={12}
												paddingY={8}
											>
												<Text as="code" variant="caption" mono weight="semibold">
													{setting.path}:{" "}
												</Text>
												<Inline gap={8}>
													<Text variant="caption" mono tone="muted">
														{settingText(setting.from, t("review.unset"))}
													</Text>
													<Text variant="caption" mono>
														{" -> "}
													</Text>
													<Box as="span" background="selected" radius="sm" paddingX={8}>
														<Text variant="caption" mono weight="medium">
															{settingText(setting.to, t("review.unset"))}
														</Text>
													</Box>
												</Inline>
											</Inline>
										))}
									</Stack>
								</Stack>
							)}
							{preview.impacts.length > 0 && (
								<Stack as="section" gap={8} aria-label={t("review.changes")}>
									<Heading as="h3" variant="label">
										{t("review.changes")}
									</Heading>
									<Stack as="ul" gap={8}>
										{preview.impacts.map((impact) => (
											<Impact key={impact.key} impact={impact} />
										))}
									</Stack>
								</Stack>
							)}
							{preview.transforms.length > 0 && (
								<Text as="p" variant="caption" tone="muted">
									{t("review.transforms", { ids: preview.transforms.map((item) => item.id).join(", ") })}
								</Text>
							)}
						</>
					)}
					{saveError && <Banner role="alert" title={saveError.message} />}
				</Stack>
				<DialogFooter>
					{saveError?.conflict || saveError?.applyFailed ? (
						<Button type="button" onClick={reloadPage}>
							{t("save.reload")}
						</Button>
					) : (
						<>
							<TextButton type="button" onClick={() => onOpenChange(false)}>
								{tc("cancel")}
							</TextButton>
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
