import { type Doc, type FieldDefinition, inOptionOrder, storedFields } from "@monti-cms/core";
import {
	Banner,
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
	StandalonePage,
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
	toText,
}: {
	editor: EntryEditorModel;
	mode: CompareMode;
	schema: SchemaRead | null;
	collection: string;
	address: string | null;
	onBack: () => void;
	/**
	 * The editor's hand-off (`useFocusHandOff` to `focusText`). An answer given here takes the comparison away, and the focus it held goes to the text.
	 * The banner of a read that did not come goes when its "try again" reads the entry: the text is not there then, so the focus goes to the
	 * comparison's first control once it is drawn.
	 */
	toText: React.RefCallback<HTMLElement>;
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

	// Without its read there is nothing to compare: the way back stays, and a read that did not come says so at the top with a way to try again (an
	// ended session has its own banner). Drawn as nothing, only the browser's Back left this screen.
	if (!server || !mine || !latest.data)
		return (
			<StandalonePage
				banner={
					<>
						<SessionEndedBanner />
						{latest.refusal && latest.refusal.status !== 401 ? (
							<Banner ref={toText} tone="danger" title={t("entry.loadFailed")} plainMeta>
								<TextButton onClick={() => void latest.reload()}>{t("entry.retry")}</TextButton>
							</Banner>
						) : null}
					</>
				}
			>
				<EditorHeader>
					<Inline gap={16} minWidth={0} paddingX={12}>
						<TextButton variant="quiet" onClick={onBack}>
							<ChevronLeft aria-hidden />
							{t("compare.back")}
						</TextButton>
						<Text variant="title">{t(mode === "conflict" ? "compare.conflictTitle" : "compare.draftTitle")}</Text>
					</Inline>
				</EditorHeader>
			</StandalonePage>
		);
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
	const stored = storedFields(schema?.schema.collections[collection]);
	/** A value as the side shows it: a choice by its option's label. */
	const words = (field: string, value: unknown) => {
		const option = labels[field]?.optionLabels;
		return stored[field]?.kind === "select" && option
			? shown(
					Array.isArray(value) ? value.map((each) => option[String(each)] ?? each) : (option[String(value)] ?? value),
				)
			: shown(value);
	};
	/**
	 * Where the two sides chose different options of a conditional field (doc 19), each side shows the fields of its own option under the
	 * choice, whole: they are what that kind of entry has, and the choice is the one place counted.
	 */
	const own = (copy: Copy, field: string) => {
		// The conditional field may itself stand in an option of another, and one of its option's fields may be a conditional field:
		// that one's chosen option's fields follow it.
		const find = (fields: Record<string, FieldDefinition>): FieldDefinition | undefined => {
			if (fields[field]) return fields[field];
			for (const each of Object.values(fields)) {
				if (each.kind !== "conditional") continue;
				for (const group of Object.values(each.fields)) {
					const found = find(group);
					if (found) return found;
				}
			}
			return undefined;
		};
		const under = (name: string, definition: FieldDefinition | undefined): string[] => {
			if (definition?.kind !== "conditional") return [];
			const chosen = String(copy.values[name]);
			const group = definition.fields[chosen] ?? {};
			// In the order the panel shows them: the one the conditional field keeps for the option.
			return inOptionOrder(Object.keys(group), labels[name]?.optionFields?.[chosen]).flatMap((inner) => [
				inner,
				...under(inner, group[inner]),
			]);
		};
		return under(field, find(schema?.schema.collections[collection]?.fields ?? {}));
	};

	const side = (copy: Copy, pick: "mine" | "server", label: string) => (
		<CompareSide
			label={label}
			properties={
				properties.length > 0
					? properties.flatMap((field) => [
							<CompareProperty key={field} label={labels[field]?.label ?? field} empty={t("entry.empty")}>
								{shown(fieldValue(copy, field)) ? (
									<Words
										parts={
											wordDiff(words(field, fieldValue(mine, field)), words(field, fieldValue(server, field)))[pick]
										}
									/>
								) : undefined}
							</CompareProperty>,
							...own(copy, field).map((inner) => (
								<CompareProperty key={inner} label={labels[inner]?.label ?? inner} empty={t("entry.empty")}>
									{shown(copy.values[inner]) ? (
										<Words parts={[{ text: words(inner, copy.values[inner]), changed: true }]} />
									) : undefined}
								</CompareProperty>
							)),
							// The side whose option has fewer fields keeps their places empty, so both bodies start at the same height.
							...Array.from(
								{ length: Math.max(own(mine, field).length, own(server, field).length) - own(copy, field).length },
								(_, index) => (
									// biome-ignore lint/suspicious/noArrayIndexKey: empty places in order; they never move.
									<CompareProperty key={`${field}:blank:${index}`} label="·" empty="·" blank />
								),
							),
						])
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
		<StandalonePage
			// The screen's banner stands at its very top, over the head row (common.md, banners).
			banner={<SessionEndedBanner />}
		>
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
				<Inline ref={toText} gap={16} justify="end" paddingX={12}>
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
									// Not read: the comparison stays, with what it compares.
									if (await editor.loadLatest()) onBack();
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
									editor.dropBrowserCopy();
									onBack();
								}}
							>
								{t("compare.drop")}
							</TextButton>
							<Button
								onClick={() => {
									editor.loadBrowserCopy();
									onBack();
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
		</StandalonePage>
	);
}
