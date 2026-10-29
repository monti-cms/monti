"use client";

import { Download } from "@carbon/icons-react";
import type { ChangeImpact } from "@monti-cms/core/internal/schema-change";
import type { SchemaDecision } from "@monti-cms/core/internal/schema-edit";
import type { ConfigIssue } from "@monti-cms/core/site";
import { useSite, useTranslator } from "@monti-cms/core/site";
import {
	Box,
	Button,
	ChangeGroup,
	ChangeLabel,
	ChangeLine,
	ChangeLines,
	ChangeNote,
	ChatError,
	Input,
	RadioGroup,
	RadioItem,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
	Sheet,
	SheetBody,
	SheetContent,
	SheetFooter,
	SheetHeader,
	SheetTitle,
	Stack,
	Text,
	TextButton,
} from "@monti-cms/ui";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { CmsApiError, errorText } from "../../api/client";
import {
	previewSchema,
	type SavedSchema,
	type SchemaEditPreview,
	type SuggestedTransform,
	saveSchema,
} from "../../api/schema";
import { useCmsMutation } from "../../api/use-cms-mutation";
import { commonMessages } from "../../lib/common.messages";
import { AdminLink } from "../../router";
import type { TranslatorFor } from "../../translator";
import { ExportDialog } from "../export/export-dialog";
import { entryHref } from "../shared/entry-href";
import { describeChange, describeHead, describeNoTransform, describeTag, describeTransform } from "./change-text";
import { schemaChangesMessages } from "./changes.messages";
import { IssueList } from "./controls";
import { settingName } from "./describe-change-item";
import { schemaMessages } from "./messages";
import { reloadPage } from "./reload";
import { schemaReviewMessages } from "./review.messages";
import {
	deletesValues,
	initialPicks,
	type Picks,
	type Removal,
	type ReviewBlock,
	type ReviewLabels,
	type ReviewTarget,
	requestOf,
	reviewBlocks,
	reviewLabels,
} from "./review-model";
import { collectionsOf, fieldAt, fieldsOf, type Obj, optionsOf, type Rename, type SettingChange } from "./schema-model";

type T = TranslatorFor<typeof schemaReviewMessages>;

/** What every block needs: the words, the names of things, the picks made so far and the way to make one. */
interface Env {
	readonly t: T;
	readonly labels: ReviewLabels;
	readonly draft: Obj;
	readonly picks: Picks | undefined;
	readonly pick: (key: string, pick: SuggestedTransform | null) => void;
}

const pickOf = (env: Env, decision: SchemaDecision): SuggestedTransform | null => env.picks?.[decision.key] ?? null;

/** The select a choice carries at the end of its row: `items` are the values it can take. */
function ChoiceSelect({
	label,
	value,
	items,
	onChange,
}: {
	label: string;
	value: string;
	items: readonly { value: string; label: string }[];
	onChange: (value: string) => void;
}) {
	return (
		<Select
			value={value}
			items={items as { value: string; label: string }[]}
			onValueChange={(next) => typeof next === "string" && onChange(next)}
		>
			<SelectTrigger size="sm" width="choice" aria-label={label}>
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
	);
}

/** The head of a block that comes from a change of the schema, with the body it is given. */
function ChangeBlock({
	block,
	change,
	env,
	children,
}: {
	block: ReviewBlock;
	change: ImpactOrDecision;
	env: Env;
	children?: ReactNode;
}) {
	const { t, labels } = env;
	const tag = describeTag(change);
	const head = describeHead(change, labels, t);
	return (
		<ChangeGroup
			kind={tag.kind}
			tag={t(`tag.${tag.word}`)}
			title={head.title}
			identifier={head.identifier}
			data-testid={`impact-${block.key}`}
		>
			{children}
		</ChangeGroup>
	);
}

type ImpactOrDecision = ChangeImpact["change"];

/** No entry holds the value, so there is nothing to choose: the block only says so. */
function Unchosen({ env }: { env: Env }) {
	return <ChangeNote>{env.t("consequence.none")}</ChangeNote>;
}

/** The count of a decision's entries, with the unit of its collection. */
const countOf = (env: Env, count: number, collection: string): string =>
	env.t("count.entries", { count, kind: env.labels.kind(collection) });

function RenameBlock({ block, env }: { block: Extract<ReviewBlock, { type: "rename" }>; env: Env }) {
	const { t } = env;
	const { decision } = block;
	const move = decision.suggestions.find((item) => item.op === "renameField" && item.to === block.to);
	const picked = pickOf(env, decision);
	const hint = decision.entries > 0 ? countOf(env, decision.entries, block.collection) : undefined;
	return (
		<ChangeGroup
			kind="edit"
			tag={t("tag.rename")}
			title={env.labels.field(block.collection, block.to)}
			identifier={`${block.from} → ${block.to}`}
			data-testid={`impact-${block.key}`}
		>
			{decision.entries === 0 || !move ? (
				<Unchosen env={env} />
			) : (
				<RadioGroup
					aria-label={env.labels.field(block.collection, block.to)}
					value={picked?.op === "renameField" ? "move" : "blank"}
					onValueChange={(value) => env.pick(decision.key, value === "move" ? move : null)}
				>
					<RadioItem value="move" label={describeTransform(move, t, { renamed: true })} hint={hint} />
					<RadioItem value="blank" label={describeNoTransform(decision.change, t, { renamed: true })} />
				</RadioGroup>
			)}
		</ChangeGroup>
	);
}

function RemovedBlock({ block, env }: { block: Extract<ReviewBlock, { type: "removed" }>; env: Env }) {
	const { t } = env;
	const { decision, collection } = block;
	const erase = decision.suggestions.find((item) => item.op === "dropField");
	const picked = pickOf(env, decision);
	const count = countOf(env, decision.entries, collection);
	const target = picked?.op === "renameField" ? picked.to : (block.targets[0] ?? "");
	const moveTo = (to: string): SuggestedTransform => ({ op: "renameField", collection, from: block.field, to });
	const value = picked?.op === "renameField" ? "move" : picked?.op === "dropField" ? "erase" : "keep";
	return (
		<ChangeBlock block={block} change={decision.change} env={env}>
			{decision.entries === 0 ? (
				<Unchosen env={env} />
			) : (
				<>
					<RadioGroup
						aria-label={env.labels.field(collection, block.field)}
						value={value}
						onValueChange={(next) =>
							env.pick(decision.key, next === "keep" ? null : next === "move" ? moveTo(target) : (erase ?? null))
						}
					>
						<RadioItem value="keep" label={describeNoTransform(decision.change, t)} hint={count} />
						{block.targets.length > 0 && (
							<RadioItem
								value="move"
								label={t("choice.moveTo")}
								control={
									<ChoiceSelect
										label={t("choice.field")}
										value={target}
										items={block.targets.map((name) => ({ value: name, label: env.labels.field(collection, name) }))}
										onChange={(to) => env.pick(decision.key, moveTo(to))}
									/>
								}
							/>
						)}
						{erase && <RadioItem value="erase" label={describeTransform(erase, t)} />}
					</RadioGroup>
					{value === "erase" ? (
						<ChangeNote danger>{t("note.erased", { count })}</ChangeNote>
					) : (
						value === "keep" && <ChangeNote>{t("note.kept")}</ChangeNote>
					)}
				</>
			)}
		</ChangeBlock>
	);
}

function RequiredBlock({ block, env }: { block: Extract<ReviewBlock, { type: "required" }>; env: Env }) {
	const { t } = env;
	const { decision, collection } = block;
	const fills = decision.suggestions.filter(
		(item): item is Extract<SuggestedTransform, { op: "setDefault" }> => item.op === "setDefault",
	);
	const picked = pickOf(env, decision);
	const filling = picked?.op === "setDefault" ? picked : null;
	const field = fieldAt(collectionsOf(env.draft)[collection] ?? {}, {}, block.field);
	const optionLabels = field ? optionsOf(field) : {};
	const free = fills.length === 1 && fills[0]?.value === "";
	const first = fills[0];
	const fill = (item: SuggestedTransform) => env.pick(decision.key, item);
	return (
		<ChangeBlock block={block} change={decision.change} env={env}>
			{decision.entries === 0 || !first ? (
				<Unchosen env={env} />
			) : (
				<>
					<RadioGroup
						aria-label={env.labels.field(collection, block.field)}
						value={filling ? "fill" : "leave"}
						onValueChange={(next) => env.pick(decision.key, next === "fill" ? first : null)}
					>
						<RadioItem
							value="fill"
							label={describeTransform(first, t, {
								count: countOf(env, decision.entries, collection),
								kind: env.labels.kind(collection),
							})}
							control={
								free ? (
									filling && (
										<Input
											width="short"
											size="sm"
											aria-label={t("choice.value")}
											value={filling.value}
											onChange={(event) => fill({ ...filling, value: event.target.value })}
										/>
									)
								) : (
									<ChoiceSelect
										label={t("choice.value")}
										value={filling?.value ?? first.value}
										items={fills.map((item) => ({ value: item.value, label: optionLabels[item.value] ?? item.value }))}
										onChange={(value) => fill({ ...first, value })}
									/>
								)
							}
						/>
						<RadioItem value="leave" label={describeNoTransform(decision.change, t)} />
					</RadioGroup>
					<ChangeNote>{t("note.required")}</ChangeNote>
				</>
			)}
		</ChangeBlock>
	);
}

function OptionBlock({ block, env }: { block: Extract<ReviewBlock, { type: "option" }>; env: Env }) {
	const { t } = env;
	const { decision, collection } = block;
	const maps = decision.suggestions.filter(
		(item): item is Extract<SuggestedTransform, { op: "mapOption" }> => item.op === "mapOption",
	);
	const picked = pickOf(env, decision);
	const mapping = picked?.op === "mapOption" ? picked : null;
	const field = fieldAt(collectionsOf(env.draft)[collection] ?? {}, {}, block.field);
	const optionLabels = field ? optionsOf(field) : {};
	const first = maps[0];
	return (
		<ChangeBlock block={block} change={decision.change} env={env}>
			{decision.entries === 0 || !first ? (
				<Unchosen env={env} />
			) : (
				<>
					<RadioGroup
						aria-label={env.labels.field(collection, block.field)}
						value={mapping ? "map" : "keep"}
						onValueChange={(next) => env.pick(decision.key, next === "map" ? first : null)}
					>
						<RadioItem
							value="keep"
							label={describeNoTransform(decision.change, t)}
							hint={countOf(env, decision.entries, collection)}
						/>
						<RadioItem
							value="map"
							label={describeTransform(first, t)}
							control={
								<ChoiceSelect
									label={t("choice.option")}
									value={mapping?.to ?? first.to}
									items={maps.map((item) => ({ value: item.to, label: optionLabels[item.to] ?? item.to }))}
									onChange={(to) => env.pick(decision.key, { ...first, to })}
								/>
							}
						/>
					</RadioGroup>
					{!mapping && <ChangeNote>{t("note.optionKept")}</ChangeNote>}
				</>
			)}
		</ChangeBlock>
	);
}

function LocaleBlock({ block, env }: { block: Extract<ReviewBlock, { type: "locale" }>; env: Env }) {
	const { t } = env;
	const { decision } = block;
	const trash = decision.suggestions.find((item) => item.op === "trashLocale");
	const picked = pickOf(env, decision);
	return (
		<ChangeGroup
			kind="drop"
			tag={t("tag.locale")}
			title={env.labels.locale(block.code)}
			identifier={
				decision.entries > 0
					? t("locale.key", {
							code: block.code,
							count: t("count.entries", { count: decision.entries, kind: "document" }),
						})
					: block.code
			}
			data-testid={`impact-${block.key}`}
		>
			{decision.entries === 0 || !trash ? (
				<Unchosen env={env} />
			) : (
				<>
					<RadioGroup
						aria-label={env.labels.locale(block.code)}
						value={picked?.op === "trashLocale" ? "trash" : "keep"}
						onValueChange={(next) => env.pick(decision.key, next === "trash" ? trash : null)}
					>
						<RadioItem value="keep" label={describeNoTransform(decision.change, t)} />
						<RadioItem value="trash" label={describeTransform(trash, t)} />
					</RadioGroup>
					<ChangeNote>{t("note.locale")}</ChangeNote>
				</>
			)}
		</ChangeGroup>
	);
}

function AddedBlock({ block, env }: { block: Extract<ReviewBlock, { type: "added" }>; env: Env }) {
	const { t } = env;
	const ts = useTranslator(schemaMessages);
	const collection = collectionsOf(env.draft)[block.collection] ?? {};
	const path = typeof collection.path === "string" ? collection.path : "";
	const kind = collection.kind === "item" ? ts("collection.kindItem") : ts("collection.kindDocument");
	return (
		<ChangeGroup
			kind="new"
			tag={t("tag.new")}
			title={env.labels.collection(block.collection)}
			identifier={`${block.collection} · ${kind}`}
			data-testid={`impact-${block.key}`}
		>
			<ChangeLines>
				{path !== "" && <ChangeLine what={t("block.address")} then={<Text mono>{path}</Text>} />}
				<ChangeLine what={t("block.fields")} then={<Text mono>{Object.keys(fieldsOf(collection)).join(", ")}</Text>} />
			</ChangeLines>
			<ChangeNote>{t("consequence.none")}</ChangeNote>
		</ChangeGroup>
	);
}

function PathBlock({ block, env }: { block: Extract<ReviewBlock, { type: "path" }>; env: Env }) {
	const { t } = env;
	const { impact } = block;
	const change = impact.change;
	if (change.kind !== "collection_path_changed") return null;
	return (
		<ChangeGroup
			kind="edit"
			tag={t("tag.address")}
			title={t("block.address")}
			identifier={env.labels.collection(change.collection)}
			data-testid={`impact-${block.key}`}
		>
			<ChangeLines>
				<ChangeLine
					what={t("line.before")}
					then={
						<Text mono tone="muted">
							{change.from ?? t("path.none")}
						</Text>
					}
				/>
				<ChangeLine what={t("line.after")} then={<Text mono>{change.to ?? t("path.none")}</Text>} />
				{impact.entries > 0 && (
					<ChangeLine
						what={t("path.entries")}
						then={t("path.entries.then", { count: countOf(env, impact.entries, change.collection) })}
					/>
				)}
			</ChangeLines>
			{impact.entries > 0 && <ChangeNote>{t("path.note")}</ChangeNote>}
		</ChangeGroup>
	);
}

/** Any other change the stored data cares about: what changed in one line, how many entries it touches, and what follows for them. */
function OtherBlock({ block, env }: { block: Extract<ReviewBlock, { type: "change" }>; env: Env }) {
	const { t } = env;
	const { impact } = block;
	const collection = "collection" in impact.change ? impact.change.collection : undefined;
	return (
		<ChangeBlock block={block} change={impact.change} env={env}>
			<ChangeLines>
				<ChangeLine
					what={describeChange(impact.change, t)}
					then={impact.entries > 0 ? countOf(env, impact.entries, collection ?? "") : ""}
					tone={impact.consequence === "deleted" ? "danger" : "default"}
				/>
			</ChangeLines>
			<ChangeNote danger={impact.consequence === "deleted"}>
				{impact.checked ? t(`consequence.${impact.consequence}`) : t("review.notChecked")}
			</ChangeNote>
		</ChangeBlock>
	);
}

/** A setting of the site or the admin: the value before and after. */
function SettingBlock({ block, env }: { block: Extract<ReviewBlock, { type: "setting" }>; env: Env }) {
	const { t } = env;
	const tn = useTranslator(schemaChangesMessages);
	const { setting } = block;
	const text = (value: unknown) =>
		value === undefined ? t("review.unset") : typeof value === "string" ? `"${value}"` : JSON.stringify(value);
	return (
		<ChangeGroup
			kind="edit"
			tag={t("tag.edit")}
			title={settingName(setting.path, tn)}
			identifier={setting.path}
			data-testid={`impact-${block.key}`}
		>
			<ChangeLines>
				<ChangeLine
					what={t("line.before")}
					then={
						<Text mono tone="muted">
							{text(setting.from)}
						</Text>
					}
				/>
				<ChangeLine what={t("line.after")} then={<Text mono>{text(setting.to)}</Text>} />
			</ChangeLines>
		</ChangeGroup>
	);
}

/**
 * The block of a collection that is deleted with its entries: what goes with it and what is cut or breaks, a way to keep a copy first, and the note that it
 * cannot be undone. Nothing has to be resolved before the apply: the links that point at the collection are cut when it is applied.
 */
function DropBlock({
	block,
	env,
	onExport,
}: {
	block: Extract<ReviewBlock, { type: "drop" }>;
	env: Env;
	onExport: () => void;
}) {
	const { t } = env;
	const site = useSite();
	const { removal, impact } = block;
	const { drop } = impact;
	const entries = t("drop.entries", { entries: drop.entries, trashed: drop.trashed, kind: removal.kind });
	const first = drop.unlinked.sample[0];
	return (
		<ChangeGroup
			kind="drop"
			tag={t("drop.tag")}
			title={removal.label}
			identifier={removal.name}
			data-testid={`impact-${block.key}`}
		>
			<ChangeLabel>{t("drop.removes")}</ChangeLabel>
			<ChangeLines>
				<ChangeLine what={entries} then={t("drop.entries.then")} tone="danger" />
				{(drop.folders > 0 || drop.addresses > 0) && (
					<ChangeLine
						what={t("drop.rest", { folders: drop.folders, addresses: drop.addresses })}
						then={t("drop.rest.then")}
						tone="danger"
					/>
				)}
				{drop.unlinked.count > 0 && (
					<ChangeLine
						what={
							<>
								{t("drop.pointing", { count: drop.unlinked.count })}
								{first && (
									<>
										{" · "}
										<TextButton
											variant="underline"
											render={<AdminLink href={entryHref(site, first.collection, first.id)} target="_blank" />}
										>
											{first.title ?? first.id.slice(0, 8)}
										</TextButton>
										{drop.unlinked.count > 1 && ` ${t("drop.pointing.more", { count: drop.unlinked.count - 1 })}`}
									</>
								)}
							</>
						}
						then={t("drop.pointing.then")}
					/>
				)}
				{drop.bodyLinks > 0 && (
					<ChangeLine what={t("drop.bodyLinks", { count: drop.bodyLinks })} then={t("drop.bodyLinks.then")} />
				)}
			</ChangeLines>
			<ChangeLabel>{t("drop.keep")}</ChangeLabel>
			<ChangeLines>
				<ChangeLine
					what={drop.folders > 0 ? `${entries} · ${t("drop.folders", { count: drop.folders })}` : entries}
					then={
						<TextButton type="button" variant="underline" onClick={onExport}>
							<Download aria-hidden />
							{t("drop.export")}
						</TextButton>
					}
				/>
			</ChangeLines>
			<ChangeNote danger>{t("drop.note")}</ChangeNote>
		</ChangeGroup>
	);
}

/** The entries the choices touch, as one line under the blocks: the first titles linking to them, and how many more. */
function Affected({ decisions, env }: { decisions: readonly SchemaDecision[]; env: Env }) {
	const { t } = env;
	const site = useSite();
	const touched = decisions.filter((decision) => decision.entries > 0 && decision.sample.length > 0);
	const total = Math.max(0, ...touched.map((decision) => decision.entries));
	const seen = new Set<string>();
	const shown = touched
		.flatMap((decision) => decision.sample)
		.filter((entry) => !seen.has(entry.id) && seen.add(entry.id))
		.slice(0, 2);
	const [first] = shown;
	if (!first) return null;
	return (
		<Text as="p" variant="note" tone="subtle">
			{t("affected.title", { kind: env.labels.kind(first.collection) })}
			{" · "}
			{shown.map((entry, index) => (
				<span key={entry.id}>
					{index > 0 && ", "}
					<TextButton
						variant="underline"
						render={<AdminLink href={entryHref(site, entry.collection, entry.id)} target="_blank" />}
					>
						{entry.title ?? entry.id.slice(0, 8)}
					</TextButton>
				</span>
			))}
			{total > shown.length &&
				` ${t("affected.more", { count: countOf(env, total - shown.length, first.collection) })}`}
		</Text>
	);
}

/** One block of the sheet, by what it is. */
function BlockView({ block, env, onExport }: { block: ReviewBlock; env: Env; onExport?: () => void }) {
	switch (block.type) {
		case "added":
			return <AddedBlock block={block} env={env} />;
		case "rename":
			return <RenameBlock block={block} env={env} />;
		case "removed":
			return <RemovedBlock block={block} env={env} />;
		case "required":
			return <RequiredBlock block={block} env={env} />;
		case "option":
			return <OptionBlock block={block} env={env} />;
		case "locale":
			return <LocaleBlock block={block} env={env} />;
		case "path":
			return <PathBlock block={block} env={env} />;
		case "drop":
			return <DropBlock block={block} env={env} onExport={onExport ?? (() => undefined)} />;
		case "change":
			return <OtherBlock block={block} env={env} />;
		case "setting":
			return <SettingBlock block={block} env={env} />;
	}
}

export interface ReviewDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	draft: Obj;
	/** The file as saved: where the names of what the draft no longer has are found. */
	saved: Obj;
	renames: readonly Rename[];
	/** The site and admin settings that differ from the file, which the entries do not care about but the writer should still see. */
	settings?: readonly SettingChange[];
	/** The collections the draft removed (`draft` no longer has them). Their entries are deleted with them when the review is applied. */
	removals?: readonly Removal[];
	/** What the changes are about, for the title. */
	target: ReviewTarget;
	baseHash: string;
	/** The problems of the last check, for the screen to mark. */
	onIssues: (issues: readonly ConfigIssue[]) => void;
	/** The file was saved (and applied). The screen reloads so everything shows the new schema. */
	onSaved: (saved: SavedSchema) => void;
	/** The file was saved but applying it to the database failed; `message` is what the server said. */
	onApplyFailed: (message: string) => void;
}

/**
 * Shows what saving would do and saves it. Opening it checks the edit on the server (no write): the problems with JSON paths, the diff, the entries each change
 * touches, and a choice of what happens to the stored values for every change that has more than one way to treat them. Each change is one block of the sheet.
 * Applying writes the file, the types and the dev database; the screen then reloads.
 */
export function ReviewDialog({
	open,
	onOpenChange,
	draft,
	saved,
	renames,
	settings = [],
	removals = [],
	target,
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
	const [saveError, setSaveError] = useState<{ message: string; conflict?: boolean } | null>(null);
	const [exporting, setExporting] = useState<Removal | null>(null);
	const skip = useRef(false);
	const dropNames = removals.map((removal) => removal.name).join("\n");
	const dropCollections = useMemo(() => (dropNames === "" ? [] : dropNames.split("\n")), [dropNames]);
	const labels = useMemo(() => reviewLabels(draft, saved), [draft, saved]);

	useEffect(() => {
		if (!open) {
			setPreview(null);
			setPicks(undefined);
			setError(null);
			setSaveError(null);
			setExporting(null);
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
				previewSchema(site, requestOf(draft, renames, picks, dropCollections), controller.signal)
					.then((result) => {
						setPreview(result);
						setError(null);
						onIssues(result.issues);
						if (!picks) {
							skip.current = true;
							setPicks(initialPicks(result.decisions));
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
	}, [open, draft, renames, picks, dropCollections, site, onIssues, t]);

	const saveMutation = useCmsMutation({
		// The impacts this sheet showed are the ones the writer reviewed; the server refuses a lossy change it was not told was seen.
		fn: (current: Picks | undefined, { site }) =>
			saveSchema(site, {
				...requestOf(draft, renames, current, dropCollections),
				baseHash,
				acknowledged: (preview?.impacts ?? []).map((impact) => impact.key),
			}),
		failure: t("save.failed"),
		// Each failure has its own text and effect in the sheet.
		inline: true,
		onSuccess: (result) => {
			if (result.saved) onSaved(result);
			else onOpenChange(false);
		},
		onError: (reason) => {
			if (reason instanceof CmsApiError) {
				if (reason.code === "schema_conflict") setSaveError({ message: t("save.conflict"), conflict: true });
				else if (reason.code === "schema_apply_failed") {
					onApplyFailed(reason.message);
					onOpenChange(false);
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
	const blocks = useMemo(
		() => (preview?.valid ? reviewBlocks({ preview, draft, renames, removals, settings }) : []),
		[preview, draft, renames, removals, settings],
	);
	const drops = blocks.filter((block) => block.type === "drop").length;
	const deletes = deletesValues(picks, preview?.decisions ?? [], drops);
	const ready =
		preview?.valid && problems.length === 0 && preview.changed && !loading && !saving && !saveError?.conflict;
	const env: Env = {
		t,
		labels,
		draft,
		picks,
		pick: (key, pick) => setPicks((current) => ({ ...current, [key]: pick })),
	};
	const what =
		target.kind === "removed"
			? target.names
					.map((name) => removals.find((item) => item.name === name)?.label ?? labels.collection(name))
					.join(", ")
			: target.kind === "collection"
				? t("review.what", { name: labels.collection(target.name), count: target.count })
				: target.kind === "area"
					? t("review.what", { name: t(`area.${target.area}`), count: target.count })
					: t("review.what.all", { count: target.count });

	return (
		<>
			<Sheet open={open} onOpenChange={onOpenChange}>
				<SheetContent>
					<SheetHeader>
						<SheetTitle of={`· ${what}`} ofMono={false}>
							{t("review.title")}
						</SheetTitle>
					</SheetHeader>
					<SheetBody data-testid="review-body" blocks>
						<Stack gap={0}>
							{saveError && (
								<Box paddingTop={16} paddingBottom={4}>
									<ChatError
										title={saveError.conflict ? t("save.conflict.title") : saveError.message}
										actions={
											saveError.conflict ? (
												<TextButton type="button" onClick={reloadPage}>
													{t("save.reload")}
												</TextButton>
											) : undefined
										}
									>
										{saveError.conflict ? saveError.message : undefined}
									</ChatError>
								</Box>
							)}
							{error && <ChatError title={error} />}
							{loading && !preview && (
								<Text as="p" tone="subtle" role="status">
									{tc("loading")}
								</Text>
							)}
							{preview && !preview.valid && (
								<ChatError title={t("review.invalid")}>
									<IssueList issues={preview.issues} />
								</ChatError>
							)}
							{problems.length > 0 && (
								<ChatError title={t("review.problems")}>
									{problems.map((problem) => (
										<span key={`${problem.id}:${problem.message}`}>{problem.message}</span>
									))}
								</ChatError>
							)}
							{preview?.valid && !preview.changed && (
								<Text as="p" tone="subtle">
									{t("review.unchanged")}
								</Text>
							)}
							{blocks.map((block) => (
								<BlockView
									key={block.key}
									block={block}
									env={env}
									onExport={block.type === "drop" ? () => setExporting(block.removal) : undefined}
								/>
							))}
							{preview?.valid && <Affected decisions={preview.decisions} env={env} />}
						</Stack>
					</SheetBody>
					<SheetFooter>
						<TextButton type="button" onClick={() => onOpenChange(false)}>
							{tc("cancel")}
						</TextButton>
						<Button
							type="button"
							variant={deletes ? "danger" : "primary"}
							disabled={!ready}
							onClick={() => void save()}
						>
							{saving ? tc("saving") : deletes ? t("drop.apply") : t("review.save")}
						</Button>
					</SheetFooter>
				</SheetContent>
			</Sheet>
			<ExportDialog
				open={exporting !== null}
				onOpenChange={(next) => !next && setExporting(null)}
				kind="collection"
				collection={exporting?.name}
				noun={exporting?.label}
			/>
		</>
	);
}
