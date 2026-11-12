import type { Doc } from "@monti-cms/core";
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
	EditorHeader,
	Inline,
	Separator,
	Stack,
	Text,
	TextButton,
} from "@monti-cms/ui";
import { ChevronLeft } from "@monti-cms/ui/icons";
import { useMemo } from "react";
import { useAdmin } from "../../operations/admin-context";
import { useRead } from "../../operations/use-operation";
import { SessionEndedBanner } from "../frame/session-ended";
import type { SchemaRead } from "../settings/schema-draft";
import { compareBodies, type Part, wordDiff } from "./compare-entries";
import { clock, dayTime } from "./dates";
import type { EntryEditorModel, EntryRead } from "./use-entry-editor";

/** What is compared: my unsaved input against a save made elsewhere, or a copy this browser kept against the server's. */
export type CompareMode = "conflict" | "draft";

type Copy = { title: string; slug: string; values: Record<string, unknown>; doc: Doc | null };

const copyOf = (read: EntryRead): Copy => ({
	title: read.entry.title,
	slug: read.entry.slug,
	values: read.entry.values,
	doc: read.entry.doc,
});

/** A copy with changes by path over it (`title`, `slug`, `doc`, `values.<field>`). */
function withChanges(copy: Copy, changes: [string, unknown][]): Copy {
	const next = { ...copy, values: { ...copy.values } };
	for (const [path, value] of changes) {
		if (path === "title") next.title = String(value ?? "");
		else if (path === "slug") next.slug = String(value ?? "");
		else if (path === "doc") next.doc = value as Doc;
		else if (path.startsWith("values.")) next.values[path.slice("values.".length)] = value;
	}
	return next;
}

const Words = ({ parts }: { parts: Part[] }) =>
	parts.map((part, index) => (
		// biome-ignore lint/suspicious/noArrayIndexKey: the parts of one text, in order; they never move.
		<CompareText key={index} changed={part.changed}>
			{part.text}
		</CompareText>
	));

const shown = (value: unknown) =>
	value === undefined || value === null || value === ""
		? ""
		: Array.isArray(value)
			? value.join(", ")
			: typeof value === "object"
				? JSON.stringify(value)
				: String(value);

/**
 * The comparison (screens.md, EditorCompare): the two copies of the entry side by side, the words that differ marked on both. Each side lists only the
 * properties that differ; the head counts the places once (`entries.compare`). The editor stays under it, so what I typed is kept while I look.
 */
export function CompareView({
	editor,
	mode,
	schema,
	collection,
	address,
	onBack,
}: {
	editor: EntryEditorModel;
	mode: CompareMode;
	schema: SchemaRead | null;
	collection: string;
	address: string | null;
	onBack: () => void;
}) {
	const { t, language } = useAdmin();
	const id = (editor.loaded as EntryRead | null)?.entry.id ?? "";
	const latest = useRead<EntryRead>("entries.get", { id });
	const server = latest.data ? copyOf(latest.data) : null;
	const mine = useMemo(() => {
		if (!server) return null;
		if (mode === "draft") return withChanges(server, editor.browserCopy?.mine ?? []);
		return {
			title: editor.title,
			slug: String(editor.value("slug") ?? ""),
			values: Object.fromEntries(editor.fields.map((field) => [field, editor.value(`values.${field}`)])),
			doc: editor.doc,
		};
	}, [server, mode, editor]);
	const places = useRead<{ places: { place: string }[] }>(
		"entries.compare",
		mine
			? {
					id,
					title: mine.title,
					slug: mine.slug,
					doc: mine.doc,
					values: Object.fromEntries(Object.entries(mine.values).map(([key, value]) => [key, value ?? null])),
				}
			: { id },
		{ skip: !mine },
	);

	if (!server || !mine || !latest.data) return null;
	const updatedAt = new Date(latest.data.entry.updatedAt);
	const labels = schema?.adminValues[collection]?.fields ?? {};
	const differing = (places.data?.places ?? []).filter((place) => place.place !== "doc.order");
	const properties = differing
		.map((place) => place.place)
		.filter((place) => place === "slug" || place.startsWith("values."))
		.map((place) => (place === "slug" ? "slug" : place.slice("values.".length)));
	const title = wordDiff(mine.title, server.title);
	const bodies = compareBodies(mine.doc, server.doc);
	const fieldValue = (copy: Copy, field: string) => (field === "slug" ? copy.slug : copy.values[field]);

	const side = (copy: Copy, pick: "mine" | "server", label: string) => (
		<CompareSide
			label={label}
			properties={
				properties.length > 0
					? properties.map((field) => (
							<CompareProperty key={field} label={labels[field]?.label ?? field} empty={t("entry.empty")}>
								{shown(fieldValue(copy, field)) ? (
									<Words parts={wordDiff(shown(fieldValue(mine, field)), shown(fieldValue(server, field)))[pick]} />
								) : undefined}
							</CompareProperty>
						))
					: undefined
			}
		>
			<CompareTitle>
				<Words parts={title[pick]} />
			</CompareTitle>
			<CompareBody>
				{bodies[pick].map((block) =>
					block.look === "heading" ? (
						<CompareHeading key={block.id}>
							<Words parts={block.parts} />
						</CompareHeading>
					) : block.look === "code" ? (
						<CompareCode key={block.id}>
							<Words parts={block.parts} />
						</CompareCode>
					) : (
						<CompareParagraph key={block.id}>
							<Words parts={block.parts} />
						</CompareParagraph>
					),
				)}
			</CompareBody>
		</CompareSide>
	);

	const savedAt = editor.browserCopy?.savedAt;
	return (
		<Stack gap={0} height="screen" overflow="clip" background="page">
			<SessionEndedBanner />
			<EditorHeader>
				<Inline gap={16} minWidth={0} paddingX={12}>
					<TextButton variant="quiet" onClick={onBack}>
						<ChevronLeft aria-hidden />
						{t("compare.back")}
					</TextButton>
					<Text variant="title">{t(mode === "conflict" ? "compare.conflictTitle" : "compare.draftTitle")}</Text>
					{address ? (
						<Text variant="meta" tone="faint" truncate>
							{address}
						</Text>
					) : null}
				</Inline>
				<Inline gap={16} justify="end" paddingX={12}>
					{places.data ? (
						<Text variant="note" tone="subtle">
							{t("compare.places", { count: differing.length })}
						</Text>
					) : null}
					<Separator orientation="vertical" length="control" flush />
					{mode === "conflict" ? (
						<>
							<TextButton
								onClick={async () => {
									await editor.loadLatest();
									onBack();
								}}
							>
								{t("compare.loadLatest")}
							</TextButton>
							<Button
								loading={editor.saving}
								onClick={async () => {
									if (await editor.saveOver()) onBack();
								}}
							>
								{t("compare.saveMine")}
							</Button>
						</>
					) : (
						<>
							<TextButton
								onClick={() => {
									if (editor.loadingCopy) return;
									editor.dropBrowserCopy();
									onBack();
								}}
							>
								{t("compare.drop")}
							</TextButton>
							<Button
								loading={editor.loadingCopy}
								onClick={() => {
									void editor.loadBrowserCopy().then(onBack);
								}}
							>
								{t("compare.load")}
							</Button>
						</>
					)}
				</Inline>
			</EditorHeader>
			<Stack gap={0} grow minHeight={0} overflow="y">
				<Compare>
					{mode === "conflict"
						? side(mine, "mine", t("compare.mine"))
						: side(mine, "mine", t("compare.browser", { at: savedAt ? dayTime(savedAt, language) : "" }))}
					{mode === "conflict"
						? side(server, "server", t("compare.latest", { version: latest.data.entry.version, at: clock(updatedAt) }))
						: side(server, "server", t("compare.server", { at: dayTime(updatedAt, language) }))}
				</Compare>
			</Stack>
		</Stack>
	);
}
