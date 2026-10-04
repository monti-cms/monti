"use client";

import type {
	Collection,
	ConditionalField,
	Field,
	LayoutGroup,
	RelationField,
	SlugField,
	ValueField,
} from "@monti-cms/core/client";
import {
	isItemCollection,
	type Locale,
	recordLocalizedFields,
	roleValue,
	type SchemaCollection,
	schemaOf,
} from "@monti-cms/core/client";
import { ChevronRight, RefreshCw } from "lucide-react";
import { type ReactNode, useMemo, useState } from "react";
import { type FieldInputParts, isFieldInputParts, useCmsAdminComponents } from "../../admin-components";
import { type SlotRequest, useSlot } from "../../slots/slots";
import { Button } from "../../ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../../ui/collapsible";
import { FieldDescription, FieldError, FieldLabel, FieldLegend, FieldSet, Field as UiField } from "../../ui/field";
import { Input } from "../../ui/input";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "../../ui/input-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../ui/select";
import { Textarea } from "../../ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "../../ui/tooltip";
import { type CmsIssue, cmsIssueMessage } from "../api-error-message";
import { type RecordCollection, useTaxonomy } from "../shared/use-taxonomy";
import { type EntryForm, type EntryFormPatch, type FormValue, recordTranslationKey } from "./entry-form";
import {
	BacklinkInput,
	EntryPicker,
	type FieldContext,
	type FieldInputProps,
	inputClass,
	multilineProps,
	OrderedEntryList,
} from "./field-inputs";
import { FieldView } from "./field-views";
import { layoutGroupsOf } from "./layout-groups";
import { MediaInput } from "./media-image-input";
import { optionOf, useRecordCreator } from "./record-create-sheet";
import { RelationCombobox } from "./relation-combobox";
import { t } from "./translate";

const fieldId = (name: string) => `cms-${name}`;

interface SchemaFieldsProps {
	collection: SchemaCollection;
	form: EntryForm;
	issues?: readonly CmsIssue[];
	context: FieldContext;
	onChange: (patch: EntryFormPatch) => void;
	onSlugChange?: (slug: string) => void;
	onRegenerateSlug?: () => void;
	/** 주소 입력의 안내 문구. 비우면 만들 값을 보여 주는 식으로 바꿀 때 쓴다. */
	slugPlaceholder?: string;
	/** 이 필드는 그리지 않는다(편집 화면 본문 위의 제목처럼 다른 곳에 입력이 있을 때). */
	omit?: readonly string[];
	/** 필드 아래의 상시 설명을 보여 줄지 여부. */
	showDescriptions?: boolean;
	/**
	 * 번역본 편집(v2 B4). 언어별 값이 아닌 필드(공통 값)는 `values`(원문 값)로 읽기 전용으로 그리고 `note`를 붙인다.
	 */
	locked?: { values: EntryForm; note: ReactNode };
	/** 이 묶음만 그린다(편집 화면 속성 칸의 탭별 나누기). 없으면 모두. */
	include?: (group: LayoutGroup) => boolean;
	/** 묶음 제목 모양. `plain`은 접지 않는 작은 제목이다(편집 화면 속성 칸). */
	sections?: "collapsible" | "plain";
}

interface FieldRowProps {
	id: string;
	label: string;
	required?: boolean;
	issue?: CmsIssue;
	help?: ReactNode;
	slot?: SlotRequest;
	/** 라벨 줄 오른쪽에 둘 것(글자 수 등). 자리 버튼보다 앞에 온다. */
	aside?: ReactNode;
	children: ReactNode;
}

/**
 * 필드 하나의 라벨·필수 표시·오류·도움말. `slot`이 있으면 라벨 옆에 자리 버튼, 입력 아래에 결과를 둔다.
 * 속성 칸의 모든 입력이 이 줄을 쓴다.
 */
export function FieldRow({ id, label, required, issue, help, slot, aside, children }: FieldRowProps) {
	if (slot) {
		return (
			<SlotFieldRow id={id} label={label} required={required} issue={issue} help={help} slot={slot} aside={aside}>
				{children}
			</SlotFieldRow>
		);
	}
	const labelNode = (
		<FieldLabel htmlFor={id} className="font-semibold text-cms-muted-foreground text-xs">
			{label} {required && <span className="text-cms-destructive">*</span>}
		</FieldLabel>
	);
	return (
		<UiField data-invalid={Boolean(issue) || undefined} className="gap-1.5">
			{aside ? (
				<div className="flex min-h-6 items-center justify-between gap-2">
					{labelNode}
					{aside}
				</div>
			) : (
				labelNode
			)}
			{children}
			{issue && <FieldError id={`${id}-error`}>{cmsIssueMessage(issue)}</FieldError>}
			{help && <FieldDescription className="text-[11px] leading-tight">{help}</FieldDescription>}
		</UiField>
	);
}

function SlotFieldRow({
	id,
	label,
	required,
	issue,
	help,
	slot,
	aside,
	children,
}: FieldRowProps & { slot: SlotRequest }) {
	const { trigger, panel } = useSlot(slot);
	return (
		<UiField data-invalid={Boolean(issue) || undefined} className="gap-1.5">
			<div className="flex min-h-6 items-center justify-between gap-2">
				<FieldLabel htmlFor={id} className="font-semibold text-cms-muted-foreground text-xs">
					{label} {required && <span className="text-cms-destructive">*</span>}
				</FieldLabel>
				{aside || trigger ? (
					<span className="flex items-center gap-1">
						{aside}
						{trigger}
					</span>
				) : null}
			</div>
			{children}
			{panel}
			{issue && <FieldError id={`${id}-error`}>{cmsIssueMessage(issue)}</FieldError>}
			{help && <FieldDescription className="text-[11px] leading-tight">{help}</FieldDescription>}
		</UiField>
	);
}

/** record 대상 관계(카테고리·태그·모음집). 검색해 고르고, `createInline`이면 없는 이름을 목록에서 바로 만든다. */
function RecordRelationInput({ field, id, value, invalid, describedBy, context, onChange }: FieldInputProps) {
	const relation = field as RelationField;
	const records = useTaxonomy(relation.to as RecordCollection);
	const creator = useRecordCreator();
	const selected = Array.isArray(value) ? value : typeof value === "string" && value ? [value] : [];
	const options = useMemo(
		() => records.options.map((option) => ({ value: option.id, label: option.title })),
		[records.options],
	);
	return (
		<>
			<RelationCombobox
				id={id}
				multiple={Boolean(relation.many)}
				aria-label={relation.label}
				placeholder={relation.placeholder ?? (relation.createInline ? t("relation.searchOrAdd") : t("relation.search"))}
				options={options}
				value={selected}
				invalid={invalid}
				describedBy={describedBy}
				disabled={context.disabled}
				onValueChange={(next) => onChange(relation.many ? next : (next[0] ?? null))}
				onCreate={
					relation.createInline
						? async (title) => {
								const saved = await creator.create(relation.to as Collection, { title });
								if (!saved) return null;
								records.remember(optionOf(saved));
								void records.reload();
								return saved.id;
							}
						: undefined
				}
			/>
			{records.error && (
				<p role="alert" className="text-cms-destructive text-xs">
					{records.error}
				</p>
			)}
			{creator.sheet}
		</>
	);
}

/** 필드 종류별 기본 입력. `input`이 컴포넌트를 가리키면 그것을, 아니면 종류에 맞는 입력을 그린다. */
function DefaultInput({ parts, ...props }: FieldInputProps & { parts?: FieldInputParts }) {
	const { field, id, value, invalid, describedBy, context, onChange } = props;
	const { fieldInputs } = useCmsAdminComponents();
	const registered = field.input ? fieldInputs?.[field.input] : undefined;
	if (registered && !isFieldInputParts(registered)) {
		const Custom = registered;
		return <Custom {...props} />;
	}
	const text = typeof value === "string" ? value : "";
	const placeholder =
		parts?.placeholder?.(props) ?? (field.kind === "text" || field.kind === "media" ? field.placeholder : undefined);

	switch (field.kind) {
		case "text":
			return field.multiline ? (
				<Textarea
					id={id}
					{...multilineProps(field)}
					autoComplete="off"
					value={text}
					aria-invalid={invalid || undefined}
					aria-describedby={describedBy}
					placeholder={placeholder}
					onChange={(event) => onChange(event.target.value)}
					className="resize-none text-xs md:text-xs"
				/>
			) : (
				<Input
					id={id}
					autoComplete="off"
					value={text}
					aria-invalid={invalid || undefined}
					aria-describedby={describedBy}
					placeholder={placeholder}
					onChange={(event) => onChange(event.target.value)}
					className={inputClass}
				/>
			);
		case "select": {
			const items = Object.entries(field.options).map(([optionValue, label]) => ({ value: optionValue, label }));
			return (
				<Select
					value={text || field.defaultValue}
					items={items}
					disabled={context.disabled}
					onValueChange={(next) => typeof next === "string" && onChange(next)}
				>
					<SelectTrigger id={id} size="sm" className="w-full" aria-describedby={describedBy}>
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						{items.map((option) => (
							<SelectItem key={option.value} value={option.value}>
								{option.label}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			);
		}
		case "relation":
			if (isItemCollection(field.to)) return <RecordRelationInput {...props} />;
			return field.many ? <OrderedEntryList {...props} /> : <EntryPicker {...props} />;
		case "media":
			return <MediaInput {...props} />;
	}
}

/**
 * 컬렉션 정의를 읽어 속성 입력을 그린다(v2 B1). 배치(`layout`)의 묶음 순서를 따르고,
 * 배치에 없는 필드는 마지막 묶음 뒤에 선언 순서대로 그린다. 조건부 필드는 조건이 맞을 때 딸린 입력을 보여 준다.
 */
export function SchemaFields({
	collection,
	form,
	issues = [],
	context,
	onChange,
	onSlugChange,
	onRegenerateSlug,
	slugPlaceholder,
	omit = [],
	showDescriptions = true,
	locked,
	include,
	sections = "collapsible",
}: SchemaFieldsProps) {
	const schema = schemaOf(collection);
	const { fieldInputs } = useCmsAdminComponents();
	const issueFor = (path: string) => issues.find((issue) => issue.path === path);
	const describedBy = (path: string) => (issueFor(path) ? `${fieldId(path)}-error` : undefined);
	const setValue = (name: string, value: FormValue) => onChange({ [name]: value });

	/** 필드 옆 자리. 읽기 전용 필드에는 두지 않는다. 적용은 입력을 바꾼 것과 같다. */
	const fieldSlot = (name: string, value: FormValue, apply: (value: FormValue) => void): SlotRequest => ({
		slot: "field",
		target: name,
		collection,
		scope: context.entryId ?? "new",
		disabled: context.disabled,
		getContext: () => ({
			collection,
			locale: context.locale,
			entryId: context.entryId,
			title: form.title,
			summary: roleValue(collection, "summary", form) || undefined,
			body: form.mdx,
			current: Array.isArray(value) ? value : typeof value === "string" ? value : undefined,
		}),
		apply: (next, mode) => {
			if (mode === "append") {
				const list = Array.isArray(value) ? value : [];
				if (!list.includes(next)) apply([...list, next]);
			} else apply(next);
		},
	});

	/** 번역본에서 원문 값을 보여 주는 공통 필드인가. */
	const isLocked = (field: Field) =>
		Boolean(locked) && field.kind !== "backlink" && field.kind !== "view" && !field.localized;

	const renderValue = (name: string, field: ValueField, readOnly = false) => {
		if (field.hidden) return null;
		const issue = readOnly ? undefined : issueFor(name);
		const source = readOnly && locked ? locked.values : form;
		const props: FieldInputProps = {
			collection,
			form: source,
			name,
			field,
			id: fieldId(name),
			value: name === "title" ? source.title : (source[name] ?? null),
			invalid: Boolean(issue),
			describedBy: describedBy(name),
			context: readOnly ? { ...context, disabled: true } : context,
			onChange: readOnly ? () => {} : (value) => setValue(name, value),
		};
		const help = readOnly && locked ? locked.note : showDescriptions ? field.description : undefined;
		// 확장이 등록한 입력 조각(이름표 줄 오른쪽·안내 문구·입력 바꾸기).
		const registered = field.input ? fieldInputs?.[field.input] : undefined;
		const parts = registered && isFieldInputParts(registered) ? registered : undefined;
		const Aside = parts?.Aside;
		const Input = parts?.Input;
		return (
			<FieldRow
				key={name}
				id={fieldId(name)}
				label={field.label}
				required={Boolean(field.required) && !readOnly}
				issue={issue}
				help={help}
				slot={readOnly || Input === null ? undefined : fieldSlot(name, props.value, props.onChange)}
				aside={Aside ? <Aside {...props} /> : undefined}
			>
				{Input === null ? null : Input ? <Input {...props} /> : <DefaultInput {...props} parts={parts} />}
			</FieldRow>
		);
	};

	const renderSlug = (name: string, field: SlugField) => {
		const issue = issueFor(name);
		const fromLabel = field.from ? (schema.fields[field.from]?.label ?? field.from) : "";
		const regenerateLabel = t("relation.regenerate", { label: fromLabel });
		return (
			<FieldRow
				key={name}
				id={fieldId(name)}
				label={field.label}
				required={Boolean(field.required)}
				issue={issue}
				help={showDescriptions ? field.description : undefined}
				slot={fieldSlot(name, form.slug, (slug) =>
					(onSlugChange ?? ((next) => onChange({ slug: next })))(typeof slug === "string" ? slug : ""),
				)}
			>
				<InputGroup className="h-8">
					<InputGroupInput
						id={fieldId(name)}
						autoComplete="off"
						aria-invalid={Boolean(issue) || undefined}
						aria-describedby={describedBy(name)}
						value={form.slug}
						onChange={(event) => (onSlugChange ?? ((slug) => onChange({ slug })))(event.target.value)}
						placeholder={slugPlaceholder ?? field.placeholder}
						className="font-mono text-xs md:text-xs"
					/>
					{onRegenerateSlug && field.from && (
						<InputGroupAddon align="inline-end">
							<Tooltip>
								<TooltipTrigger
									render={
										<InputGroupButton
											size="icon-xs"
											aria-label={regenerateLabel}
											disabled={context.disabled}
											onClick={onRegenerateSlug}
										/>
									}
								>
									<RefreshCw aria-hidden />
								</TooltipTrigger>
								<TooltipContent side="bottom">{regenerateLabel}</TooltipContent>
							</Tooltip>
						</InputGroupAddon>
					)}
				</InputGroup>
			</FieldRow>
		);
	};

	const renderConditional = (name: string, field: ConditionalField) => {
		const readOnly = isLocked(field);
		const source = readOnly && locked ? locked.values : form;
		const selected = typeof source[name] === "string" ? (source[name] as string) : field.discriminant.defaultValue;
		const nested = field.values[selected] ?? {};
		return (
			<div key={name} className="space-y-3">
				{renderValue(name, field.discriminant, readOnly)}
				{Object.entries(nested).map(([nestedName, nestedField]) => renderValue(nestedName, nestedField, readOnly))}
			</div>
		);
	};

	const renderField = (name: string) => {
		if (omit.includes(name)) return null;
		const field: Field | undefined = schema.fields[name];
		if (!field) return null;
		if (field.kind === "slug") return renderSlug(name, field);
		if (field.kind === "conditional") return renderConditional(name, field);
		if (field.kind === "view") {
			if (field.hidden) return null;
			const view = (
				<FieldView key={name} view={field.view} collection={collection} form={form} entry={context.entry ?? null} />
			);
			return field.label ? (
				<FieldRow
					key={name}
					id={fieldId(name)}
					label={field.label}
					help={showDescriptions ? field.description : undefined}
				>
					{view}
				</FieldRow>
			) : (
				view
			);
		}
		if (field.kind === "backlink") {
			// 번역본에서는 원문 값을 보여 주기만 한다(관계는 원문을 가리킨다).
			const readOnly = Boolean(locked);
			const targetId = context.groupId ?? context.entryId;
			return (
				<FieldRow
					key={name}
					id={fieldId(name)}
					label={field.label}
					help={readOnly && locked ? locked.note : showDescriptions ? field.description : undefined}
				>
					<BacklinkInput
						field={field}
						targetId={targetId}
						disabled={context.disabled || readOnly}
						shared={
							targetId === context.entryId && context.incomingReferences && context.refreshIncomingReferences
								? {
										references: context.incomingReferences,
										loading: Boolean(context.incomingReferencesLoading),
										refresh: context.refreshIncomingReferences,
									}
								: undefined
						}
					/>
				</FieldRow>
			);
		}
		return renderValue(name, field, isLocked(field));
	};

	const groups = layoutGroupsOf(collection).filter((group) => !include || include(group));

	return (
		<>
			{groups.map((group, index) => {
				const visible = group.fields.filter((name) => {
					const field = schema.fields[name];
					return field && !omit.includes(name) && !(field.kind !== "conditional" && "hidden" in field && field.hidden);
				});
				if (visible.length === 0) return null;
				const key = `${group.group ?? "group"}-${index}`;
				if (!group.group) {
					return (
						<div key={key} className="space-y-4">
							{visible.map(renderField)}
						</div>
					);
				}
				if (sections === "plain") {
					// 묶음이 하나뿐이면(탭 하나에 한 묶음) 제목을 달지 않는다.
					if (groups.length === 1) {
						return (
							<div key={key} className="space-y-4">
								{visible.map(renderField)}
							</div>
						);
					}
					return (
						<section key={key} aria-label={group.group} className="space-y-4 border-t pt-4">
							<h3 className="font-medium text-[11px] text-cms-muted-foreground uppercase tracking-wide">
								{group.group}
							</h3>
							{visible.map(renderField)}
						</section>
					);
				}
				return (
					<LayoutSection
						key={key}
						title={group.group}
						// 값이나 발행 문제가 있는 묶음은 접어 두지 않는다.
						defaultOpen={
							!group.collapsed ||
							visible.some((name) => {
								const value = form[name];
								return Boolean(issueFor(name)) || (Array.isArray(value) ? value.length > 0 : Boolean(value));
							})
						}
					>
						{visible.map(renderField)}
					</LayoutSection>
				);
			})}
		</>
	);
}

function LayoutSection({ title, defaultOpen, children }: { title: string; defaultOpen: boolean; children: ReactNode }) {
	const [open, setOpen] = useState(defaultOpen);
	return (
		<Collapsible open={open} onOpenChange={setOpen}>
			<FieldSet className="gap-3">
				<FieldLegend variant="label" className="mb-0">
					<CollapsibleTrigger
						render={
							<Button
								type="button"
								variant="ghost"
								size="xs"
								className="-ml-2 font-semibold text-cms-muted-foreground text-xs"
							/>
						}
					>
						<ChevronRight className={`transition-transform ${open ? "rotate-90" : ""}`} />
						{title}
					</CollapsibleTrigger>
				</FieldLegend>
				<CollapsibleContent className="space-y-4">{children}</CollapsibleContent>
			</FieldSet>
		</Collapsible>
	);
}

/**
 * record 컬렉션(카테고리·태그·모음집)의 다른 언어 이름·설명(v2 B4). 비우면 공개 화면이 기본 언어 값을 쓴다.
 */
/**
 * record 컬렉션(카테고리·태그·모음집)의 한 언어 값. 분류 편집 패널의 언어 탭이 쓴다(v2 B4).
 * 비워 두면 그 언어 화면에서도 기본 언어 값을 쓴다.
 */
export function RecordLocaleFields({
	collection,
	locale,
	form,
	disabled,
	onChange,
}: {
	collection: SchemaCollection;
	locale: Locale;
	form: EntryForm;
	disabled: boolean;
	onChange: (patch: EntryFormPatch) => void;
}) {
	const schema = schemaOf(collection);
	return (
		<div className="space-y-4">
			{recordLocalizedFields(collection).map((field) => {
				const key = recordTranslationKey(field, locale);
				const definition = schema.fields[field];
				// 언어는 분류 칸의 언어 탭이 이미 보인다.
				const label = definition?.label ?? field;
				const multiline = definition?.kind === "text" && definition.multiline;
				const value = typeof form[key] === "string" ? (form[key] as string) : "";
				return (
					<FieldRow key={key} id={fieldId(key)} label={label}>
						{multiline ? (
							<Textarea
								id={fieldId(key)}
								{...multilineProps(definition)}
								autoComplete="off"
								lang={locale}
								value={value}
								disabled={disabled}
								onChange={(event) => onChange({ [key]: event.target.value })}
								className="resize-none text-xs md:text-xs"
							/>
						) : (
							<Input
								id={fieldId(key)}
								autoComplete="off"
								lang={locale}
								value={value}
								disabled={disabled}
								onChange={(event) => onChange({ [key]: event.target.value })}
								className={inputClass}
							/>
						)}
					</FieldRow>
				);
			})}
		</div>
	);
}
