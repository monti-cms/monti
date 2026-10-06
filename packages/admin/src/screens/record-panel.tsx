"use client";

import {
	COLLECTION_DEFINITIONS,
	type Collection,
	cmsApiUrl,
	createTranslator,
	DEFAULT_LOCALE,
	LOCALES,
	type Locale,
	localeLabel,
	recordLocalizedFields,
	type SchemaCollection,
	schemaOf,
	slugFieldOf,
	slugFromValues,
} from "@monti-cms/core/client";
import { emptyStoredDocument } from "@monti-cms/core/mdx";
import { useEffect, useRef, useState } from "react";
import { cn } from "../lib/utils/cn";
import { Button } from "../ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { CmsApiError, cmsFetch, errorText } from "./admin-api";
import { cmsIssueMessage } from "./api-error-message";
import {
	EMPTY_FORM,
	type EntryData,
	type EntryForm,
	type EntryFormPatch,
	formFromEntry,
	metadataFromForm,
	recordTranslationKey,
} from "./entries/entry-form";
import { RecordLocaleFields, SchemaFields } from "./entries/schema-fields";
import { EntryFormProvider } from "./entries/use-field";
import { screensMessages } from "./messages";
import { useConfirm } from "./shared/confirm-dialog";
import { SidePanelHeader } from "./shared/side-panel";

const t = createTranslator(screensMessages);

export type RecordTarget = { collection: Collection; id: string | null };

/** Whether that locale tab has any per-locale value (`localized: true` text field). The default locale is the field's own value. */
function hasLocaleValues(collection: SchemaCollection, form: EntryForm, locale: Locale): boolean {
	return recordLocalizedFields(collection).some((field) => {
		const value = locale === DEFAULT_LOCALE ? form[field] : form[recordTranslationKey(field, locale)];
		return typeof value === "string" && value.trim() !== "";
	});
}

/**
 * Taxonomy (category, tag, series) edit panel. Opens beside the list. `저장` validates and then applies straight to the public values, and
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
	className,
}: {
	target: RecordTarget;
	onClose: () => void;
	/** After saving (a new item is added). Passes the item the server returned. */
	onSaved: (saved: EntryData) => void;
	/** When unsaved changes appear or go away. Used to ask before the list opens another item. */
	onDirtyChange?: (dirty: boolean) => void;
	/** Initial values of a new item (e.g. a name when added by search term in the entry edit screen). */
	initial?: EntryFormPatch;
	className?: string;
}) {
	const initialRef = useRef(initial);
	const [loaded, setLoaded] = useState<EntryData | null>(null);
	const [form, setFormState] = useState<EntryForm>(EMPTY_FORM);
	const [locale, setLocale] = useState<Locale>(DEFAULT_LOCALE);
	const [error, setError] = useState<string | null>(null);
	const [isSaving, setIsSaving] = useState(false);
	const [isDirty, setIsDirty] = useState(false);
	const { confirmDiscard, dialog } = useConfirm();

	const { collection, id } = target;
	const label = COLLECTION_DEFINITIONS[collection].label;
	const heading = id ? t("record.edit", { label }) : t("list.add", { label });
	const title = form.title;
	/** Hint for the value that will be generated when the slug is empty. If the slug field has no `from`, uses the field's hint text as is. */
	const slugFrom = slugFieldOf(collection)?.from;
	const slugHint = slugFrom
		? t("record.slugHint", { name: schemaOf(collection).fields[slugFrom]?.label ?? slugFrom })
		: undefined;

	useEffect(() => {
		setLoaded(null);
		setFormState(id ? EMPTY_FORM : ({ ...EMPTY_FORM, ...initialRef.current } as EntryForm));
		setLocale(DEFAULT_LOCALE);
		setError(null);
		setIsDirty(false);
		if (!id) return;
		let cancelled = false;
		cmsFetch<EntryData>(cmsApiUrl(`/v1/entries/${id}`))
			.then((entry) => {
				if (cancelled) return;
				setLoaded(entry);
				setFormState(formFromEntry(entry));
			})
			.catch((err) => {
				if (!cancelled) setError(errorText(err, t("record.loadFailed", { label })));
			});
		return () => {
			cancelled = true;
		};
	}, [id, label]);

	useEffect(() => onDirtyChange?.(isDirty), [isDirty, onDirtyChange]);

	const setForm = (patch: EntryFormPatch) => {
		setFormState((current) => ({ ...current, ...patch }) as EntryForm);
		setIsDirty(true);
	};

	const close = async () => {
		if (await confirmDiscard(isDirty)) onClose();
	};

	const save = async () => {
		if (!title.trim()) return;
		const built = metadataFromForm({ ...form, title: title.trim() }, collection, loaded?.working.metadata ?? {});
		if ("error" in built) {
			setError(built.error);
			return;
		}
		setIsSaving(true);
		setError(null);
		try {
			const saved =
				id && loaded
					? await cmsFetch<EntryData>(cmsApiUrl(`/v1/entries/${id}`), {
							method: "PATCH",
							json: {
								expectedVersion: loaded.version,
								slug: form.slug.trim() || slugFromValues(collection, form) || null,
								metadata: built.metadata,
							},
							fallback: t("record.saveFailed"),
						})
					: await cmsFetch<EntryData>(cmsApiUrl("/v1/entries"), {
							method: "POST",
							json: {
								collection,
								slug: form.slug.trim() || null,
								metadata: built.metadata,
								doc: emptyStoredDocument(),
							},
							fallback: t("record.saveFailed"),
						});
			// The panel stays open. Switch to the received item so the next save is based on the new revision.
			if (id) setLoaded(saved);
			setIsDirty(false);
			onSaved(saved);
		} catch (err) {
			setError(
				err instanceof CmsApiError && err.issues.length > 0
					? err.issues.map(cmsIssueMessage).join("\n")
					: errorText(err, t("record.saveFailed")),
			);
		} finally {
			setIsSaving(false);
		}
	};

	return (
		<aside aria-label={heading} className={cn("flex h-full flex-col border-l bg-cms-background text-sm", className)}>
			<SidePanelHeader title={heading} onClose={() => void close()} />
			<form
				className="flex min-h-0 flex-1 flex-col"
				onSubmit={(event) => {
					event.preventDefault();
					void save();
				}}
			>
				<EntryFormProvider value={{ collection, form, setForm, disabled: isSaving, entryId: id ?? undefined }}>
					<Tabs
						value={locale}
						onValueChange={(value) => setLocale(value as Locale)}
						className="min-h-0 flex-1 gap-0 overflow-hidden"
					>
						<TabsList variant="line" className="h-10 w-full shrink-0 justify-start gap-4 border-b px-4">
							{LOCALES.map((option) => {
								const filled = hasLocaleValues(collection, form, option);
								const name = localeLabel(option);
								return (
									<TabsTrigger
										key={option}
										value={option}
										aria-label={
											option === DEFAULT_LOCALE
												? name
												: t(filled ? "record.translationOn" : "record.translationOff", { name })
										}
										className="flex-none gap-1.5 px-0 text-xs"
									>
										{name}
										{option !== DEFAULT_LOCALE && (
											<span
												aria-hidden
												className={cn(
													"size-1.5 rounded-full",
													filled ? "bg-emerald-500" : "border border-cms-muted-foreground/50",
												)}
											/>
										)}
									</TabsTrigger>
								);
							})}
						</TabsList>
						<div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
							<TabsContent value={DEFAULT_LOCALE} className="space-y-4">
								<SchemaFields slugPlaceholder={slugFromValues(collection, form) || slugHint} />
								{id && <p className="text-cms-muted-foreground text-xs">{t("record.slugChange")}</p>}
							</TabsContent>
							{LOCALES.filter((option) => option !== DEFAULT_LOCALE).map((option) => (
								<TabsContent key={option} value={option} className="space-y-4">
									<p className="text-cms-muted-foreground text-xs leading-relaxed">
										{t("record.localeEmpty", { name: localeLabel(option) })}
									</p>
									<RecordLocaleFields collection={collection} locale={option} />
								</TabsContent>
							))}
						</div>
					</Tabs>
				</EntryFormProvider>
				<div className="shrink-0 space-y-2 border-t px-4 py-3">
					{error && (
						<p role="alert" className="whitespace-pre-wrap text-cms-destructive text-xs">
							{error}
						</p>
					)}
					<div className="flex justify-end gap-2">
						<Button type="button" variant="outline" size="sm" onClick={() => void close()}>
							{t("common.cancel")}
						</Button>
						<Button type="submit" size="sm" disabled={!title.trim() || isSaving || Boolean(id && !loaded)}>
							{isSaving ? t("common.saving") : t("common.save")}
						</Button>
					</div>
				</div>
			</form>
			{dialog}
		</aside>
	);
}
