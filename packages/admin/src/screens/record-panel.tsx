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
import { screensMessages } from "./messages";
import { useConfirm } from "./shared/confirm-dialog";
import { SidePanelHeader } from "./shared/side-panel";

const t = createTranslator(screensMessages);

export type RecordTarget = { collection: Collection; id: string | null };

/** 그 언어 탭에 언어별 값(`localized: true` 텍스트 필드)이 하나라도 있는가. 기본 언어는 필드 자체의 값이다. */
function hasLocaleValues(collection: SchemaCollection, form: EntryForm, locale: Locale): boolean {
	return recordLocalizedFields(collection).some((field) => {
		const value = locale === DEFAULT_LOCALE ? form[field] : form[recordTranslationKey(field, locale)];
		return typeof value === "string" && value.trim() !== "";
	});
}

/**
 * 분류(카테고리·태그·모음집) 편집 패널. 목록 옆에 열린다(§5.2). `저장`이 검증 후 곧바로 공개 값에 반영되고
 * 자동 저장은 하지 않는다. 저장한 뒤에도 칸은 열린 채 남는다(새 항목이면 부모가 만든 항목으로 바꿔 연다).
 * 저장하지 않은 채 닫으면 버릴지 묻는다. 위의 언어 탭마다 번역이 있는지 보이고, 다른 언어 탭에서는 그 언어 이름·설명만 고친다.
 * 모음집 글 목록과 주소는 모든 언어가 같아 기본 언어 탭에서 고친다. 아직 공개되지 않은 글도 담을 수 있다(§6.4).
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
	/** 저장(새 항목은 추가)한 뒤. 서버가 돌려준 항목을 넘긴다. */
	onSaved: (saved: EntryData) => void;
	/** 저장하지 않은 변경이 생기거나 없어질 때. 목록이 다른 항목을 열기 전에 묻는 데 쓴다. */
	onDirtyChange?: (dirty: boolean) => void;
	/** 새 항목의 처음 값(글 편집 화면에서 검색어로 추가할 때의 이름 등). */
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
	/** 주소를 비우면 만들 값의 안내. 주소 필드의 `from`이 없으면 필드의 안내 문구를 그대로 쓴다. */
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
							json: { collection, slug: form.slug.trim() || null, metadata: built.metadata, mdx: "" },
							fallback: t("record.saveFailed"),
						});
			// 칸은 열린 채 남는다. 다음 저장이 새 판을 기준으로 하도록 받은 항목으로 바꾼다.
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
							<SchemaFields
								collection={collection}
								form={form}
								context={{ entryId: id ?? undefined, disabled: isSaving }}
								onChange={setForm}
								slugPlaceholder={slugFromValues(collection, form) || slugHint}
							/>
							{id && <p className="text-cms-muted-foreground text-xs">{t("record.slugChange")}</p>}
						</TabsContent>
						{LOCALES.filter((option) => option !== DEFAULT_LOCALE).map((option) => (
							<TabsContent key={option} value={option} className="space-y-4">
								<p className="text-cms-muted-foreground text-xs leading-relaxed">
									{t("record.localeEmpty", { name: localeLabel(option) })}
								</p>
								<RecordLocaleFields
									collection={collection}
									locale={option}
									form={form}
									disabled={isSaving}
									onChange={setForm}
								/>
							</TabsContent>
						))}
					</div>
				</Tabs>
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
