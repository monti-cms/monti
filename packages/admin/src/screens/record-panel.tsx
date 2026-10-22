"use client";

import { emptyStoredDocument } from "@monti-cms/core/document";
import {
	type Collection,
	type Locale,
	type SchemaCollectionName,
	type Site,
	useSite,
	useTranslator,
} from "@monti-cms/core/site";
import { Box, PageTabs, Stack, StatusIndicator, TabsContent, TabsTrigger, Text } from "@monti-cms/ui";
import { Tabs as OpenTabs } from "@monti-cms/ui/internal";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { CmsApiError, errorText } from "../api/client";
import { createEntry, type EntryWriteResult, entriesKeys, getEntry, updateEntry } from "../api/entries";
import { issueLine } from "../api/error-message";
import { useCmsMutation } from "../api/use-cms-mutation";
import { commonMessages } from "../lib/common.messages";
import {
	EMPTY_FORM,
	type EntryData,
	type EntryForm,
	type EntryFormPatch,
	formFromEntry,
	formTitle,
	metadataFromForm,
	recordTranslationKey,
	titlePatch,
} from "./entries/entry-form";
import { RecordLocaleFields, SchemaFields } from "./entries/schema-fields";
import { EntryFormProvider } from "./entries/use-field";
import { collectionTranslated } from "./list-columns";
import { screensMessages } from "./messages";
import { useConfirm } from "./shared/confirm-dialog";
import { EditorFooter } from "./shared/editor-footer";
import { SidePanelHeader } from "./shared/side-panel";
import { useDraftEditor } from "./shared/use-draft-editor";

export type RecordTarget = { collection: Collection; id: string | null };

/** Whether that locale tab has any per-locale value (`localized: true` text field). The default locale is the field's own value. */
function hasLocaleValues(site: Site, collection: SchemaCollectionName, form: EntryForm, locale: Locale): boolean {
	return site.recordLocalizedFields(collection).some((field) => {
		const value = locale === site.DEFAULT_LOCALE ? form[field] : form[recordTranslationKey(field, locale)];
		return typeof value === "string" && value.trim() !== "";
	});
}

/**
 * Taxonomy (category, tag, series) edit panel. Opens beside the list. "Save" validates and then applies straight to the public values, and
 * there is no autosave. The panel stays open after saving (for a new item, it switches to open the item the parent created).
 * Closing with unsaved changes asks whether to discard. Each locale tab above shows whether a translation exists, and on other locale tabs only that locale's name and description are edited.
 * A series' post list and slug are the same in all locales, so they are edited on the default locale tab. Unpublished posts can be included too.
 */
export function RecordPanel({
	target,
	onClose,
	onSaved,
	onDirtyChange,
	initial,
}: {
	target: RecordTarget;
	onClose: () => void;
	/** After saving (a new item is added). Passes the item the server returned. */
	onSaved: (saved: EntryData) => void;
	/** When unsaved changes appear or go away. Used to ask before the list opens another item. */
	onDirtyChange?: (dirty: boolean) => void;
	/** Initial values of a new item (e.g. a name when added by search term in the entry edit screen). */
	initial?: EntryFormPatch;
}) {
	const site = useSite();
	const t = useTranslator(screensMessages);
	const tc = useTranslator(commonMessages);
	const initialRef = useRef(initial);
	const [loaded, setLoaded] = useState<EntryData | null>(null);
	const [locale, setLocale] = useState<Locale>(site.DEFAULT_LOCALE);
	const [error, setError] = useState<string | null>(null);
	const { confirmDiscard, dialog } = useConfirm();

	const { collection, id } = target;
	// A new item starts from the blank form (plus the initial values); an existing one from the entry the server returned.
	const empty = useMemo(() => (id ? EMPTY_FORM : ({ ...EMPTY_FORM, ...initialRef.current } as EntryForm)), [id]);
	const savedForm = useMemo(() => (id && loaded ? formFromEntry(site, loaded) : null), [id, loaded, site]);

	const saveMutation = useCmsMutation<{ slug: string; metadata: Record<string, unknown> }, EntryWriteResult>({
		fn: ({ slug, metadata }, { site }) =>
			id && loaded
				? updateEntry(
						site,
						id,
						{
							expectedVersion: loaded.version,
							slug: slug || null,
							metadata,
						},
						tc("saveFailed"),
					)
				: createEntry(site, { collection, slug: slug || null, metadata, doc: emptyStoredDocument() }, tc("saveFailed")),
		failure: tc("saveFailed"),
		inline: true,
		onSuccess: ({ entry: saved }) => {
			// The panel stays open. Switch to the received item so the next save is based on the new revision.
			if (id) setLoaded(saved);
			onSaved(saved);
		},
		onError: (err) =>
			setError(
				err instanceof CmsApiError && err.issues.length > 0
					? err.issues.map((issue) => issueLine(issue)).join("\n")
					: errorText(site, err, tc("saveFailed")),
			),
	});

	const {
		draft: form,
		update,
		replace,
		dirty,
		isNew,
	} = useDraftEditor<EntryForm>({ saved: savedForm, empty, onDirtyChange, saving: saveMutation.isPending });
	const isSaving = saveMutation.isPending;

	const label = site.COLLECTION_DEFINITIONS[collection].label;
	const heading = id ? t("record.edit", { label }) : t("list.add", { label });
	const title = formTitle(site, collection, form);
	// Locale tabs only when the collection has a per-locale field; otherwise the other locale tabs would be empty.
	const translated = collectionTranslated(site, collection);
	/** Hint for the value that will be generated when the slug is empty. If the slug field has no `from`, uses the field's hint text as is. */
	const slugFrom = site.slugFieldOf(collection)?.from;
	const slugHint = slugFrom
		? t("record.slugHint", { name: site.schemaOf(collection).fields[slugFrom]?.label ?? slugFrom })
		: undefined;

	// The panel keeps the user's edits, so a reload of the entry (after a save, say) must not replace the form: it is filled once per entry.
	const appliedRef = useRef<string | null>(null);
	// biome-ignore lint/correctness/useExhaustiveDependencies: reset only when another entry is opened
	useEffect(() => {
		appliedRef.current = null;
		setLoaded(null);
		replace(id ? EMPTY_FORM : ({ ...EMPTY_FORM, ...initialRef.current } as EntryForm));
		setLocale(site.DEFAULT_LOCALE);
		setError(null);
	}, [id]);

	const entryQuery = useQuery({
		queryKey: entriesKeys.detail(id ?? ""),
		queryFn: ({ signal }) => getEntry(site, id as string, signal),
		enabled: Boolean(id),
		gcTime: 0,
		retry: false,
	});
	useEffect(() => {
		const entry = entryQuery.data;
		if (!id || !entry || appliedRef.current === id) return;
		appliedRef.current = id;
		setLoaded(entry);
	}, [id, entryQuery.data]);
	const loadError = entryQuery.error ? errorText(site, entryQuery.error, t("record.loadFailed", { label })) : null;

	const setForm = (patch: EntryFormPatch) => update((current) => ({ ...current, ...patch }) as EntryForm);

	const close = async () => {
		if (await confirmDiscard(dirty)) onClose();
	};

	const save = () => {
		if (!title.trim()) return;
		const built = metadataFromForm(
			site,
			{ ...form, ...titlePatch(site, collection, title.trim()) },
			collection,
			loaded?.working.metadata ?? {},
		);
		if ("error" in built) {
			setError(built.error);
			return;
		}
		setError(null);
		saveMutation.mutate({
			slug: form.slug.trim() || (id && loaded ? site.slugFromValues(collection, form) : ""),
			metadata: built.metadata,
		});
	};

	return (
		<Stack as="aside" aria-label={heading} gap="none" height="full" border="left" background="page">
			<SidePanelHeader title={heading} onClose={() => void close()} />
			<Stack
				as="form"
				gap="none"
				grow
				minHeight={0}
				onSubmit={(event) => {
					event.preventDefault();
					save();
				}}
			>
				<EntryFormProvider value={{ collection, form, setForm, disabled: isSaving, entryId: id ?? undefined }}>
					{/* design-system: needs a fill option on Tabs (take the height left under the header, as a column) */}
					<OpenTabs
						value={locale}
						onValueChange={(value) => setLocale(value as Locale)}
						className="min-h-0 flex-1 gap-0 overflow-hidden"
					>
						{translated && (
							<PageTabs inset="panel">
								{site.LOCALES.map((option) => {
									const filled = hasLocaleValues(site, collection, form, option);
									const name = site.localeLabel(option);
									return (
										<TabsTrigger
											key={option}
											value={option}
											aria-label={
												option === site.DEFAULT_LOCALE
													? name
													: t(filled ? "record.translationOn" : "record.translationOff", { name })
											}
										>
											{name}
											{option !== site.DEFAULT_LOCALE && (
												<StatusIndicator
													size="xs"
													tone={filled ? "success" : "neutral"}
													shape={filled ? "dot" : "ring"}
												/>
											)}
										</TabsTrigger>
									);
								})}
							</PageTabs>
						)}
						<TabsContent value={site.DEFAULT_LOCALE} fill scroll>
							<Stack gap="comfortable" padding="comfortable">
								<SchemaFields slugPlaceholder={site.slugFromValues(collection, form) || slugHint} />
								{id && (
									<Text as="p" variant="caption" tone="muted">
										{t("record.slugChange")}
									</Text>
								)}
							</Stack>
						</TabsContent>
						{(translated ? site.PREFIXED_LOCALES : []).map((option) => (
							<TabsContent key={option} value={option} fill scroll>
								<Stack gap="comfortable" padding="comfortable">
									<Text as="p" variant="caption" tone="muted">
										{t("record.localeEmpty", { name: site.localeLabel(option) })}
									</Text>
									<RecordLocaleFields collection={collection} locale={option} />
								</Stack>
							</TabsContent>
						))}
					</OpenTabs>
				</EntryFormProvider>
				<Box shrink={false} border="top" paddingX="comfortable" paddingY="normal">
					<EditorFooter
						// A new item can be saved as it is (a name may come prefilled); an existing one only once it was changed.
						dirty={dirty || isNew}
						saving={isSaving}
						canSave={Boolean(title.trim()) && !(id && !loaded)}
						error={error ?? loadError}
						align="end"
						onCancel={() => void close()}
					/>
				</Box>
			</Stack>
			{dialog}
		</Stack>
	);
}
