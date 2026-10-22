"use client";

import type { ConfigIssue } from "@monti-cms/core/site";
import { useTranslator } from "@monti-cms/core/site";
import {
	Button,
	cn,
	FormFieldDescription,
	FormFieldError,
	FormFieldLabel,
	IconButton,
	Input,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
	Switch,
	Tooltip,
	TooltipContent,
	TooltipTrigger,
	FormField as UiField,
} from "@monti-cms/ui";
import { ArrowDown, ArrowUp, Undo2, X } from "lucide-react";
import { createContext, type ReactNode, useContext, useId, useState } from "react";
import { type CONTROL_WIDTH, HELP, Labeled } from "../shared/labeled";
import { schemaMessages } from "./messages";
import { nameProblem, type Obj, sameJson, sectionOf } from "./schema-model";

/** What every editor of the screen reads: whether the screen is read-only, the vocabulary of body lists, and the problems of the last check. */
export interface SchemaEditContext {
	readonly disabled: boolean;
	readonly vocabulary: { readonly blocks: readonly string[]; readonly marks: readonly string[] };
	readonly issues: readonly ConfigIssue[];
	readonly collectionNames: readonly string[];
	/** Collections defined in code: the preview keeps them next to the file's. */
	readonly codeCollections: readonly string[];
	/** The file as edited, for editors that look at another collection (a relation's target, a backlink's relation). */
	readonly file: Obj;
	/** The file as saved on disk: what a field is reverted to. */
	readonly saved: Obj;
}

const Context = createContext<SchemaEditContext>({
	disabled: true,
	vocabulary: { blocks: [], marks: [] },
	issues: [],
	collectionNames: [],
	codeCollections: [],
	file: {},
	saved: {},
});
export const SchemaEditProvider = Context.Provider;
export const useSchemaEdit = () => useContext(Context);

/** The problems of the last check at `path` or below it. */
export function useIssuesUnder(path: string, exclude?: string): readonly ConfigIssue[] {
	const { issues } = useSchemaEdit();
	return issues.filter(
		(issue) =>
			(issue.path === path || issue.path.startsWith(`${path}.`) || issue.path.startsWith(`${path}[`)) &&
			!(exclude && issue.path.startsWith(`${path}${exclude}`)),
	);
}

/**
 * For one setting of `site` or `admin`: the function that puts the saved value back while the draft differs from it, `undefined` while it does not.
 * `set` writes one key of the section (a value of `undefined` removes it).
 */
export function useSettingRevert(
	section: "site" | "admin",
	set: (key: string, value: unknown) => void,
): (key: string) => (() => void) | undefined {
	const { saved, file } = useSchemaEdit();
	return (key) => {
		const before = sectionOf(saved, section)[key];
		return sameJson(before, sectionOf(file, section)[key]) ? undefined : () => set(key, before);
	};
}

/** A small dot that says "this has changes": the accent colour, with the word for a screen reader. */
export function ChangeDot({ className }: { className?: string }) {
	const t = useTranslator(schemaMessages);
	return (
		<span className={cn("inline-flex shrink-0 items-center", className)} data-testid="change-dot">
			<span aria-hidden className="size-1.5 rounded-full bg-monti-accent-emphasis" />
			<span className="sr-only">{t("changed")}</span>
		</span>
	);
}

/** The marker of a field that differs from the saved file, with the button that puts the saved value back. Shown only while the field is changed. */
export function RevertMark({ name, onRevert }: { name: string; onRevert: () => void }) {
	const t = useTranslator(schemaMessages);
	const { disabled } = useSchemaEdit();
	return (
		<span className="inline-flex items-center gap-0.5" data-testid="field-changed">
			<ChangeDot />
			<IconButton
				label={t("revert.named", { name })}
				size="icon-xs"
				disabled={disabled}
				className="size-5 text-monti-muted"
				onClick={onRevert}
			>
				<Undo2 aria-hidden className="size-3" />
			</IconButton>
		</span>
	);
}

export function IssueList({ issues }: { issues: readonly ConfigIssue[] }) {
	if (issues.length === 0) return null;
	return (
		<ul className="flex flex-col gap-0.5 text-monti-caption text-monti-danger" data-testid="schema-issues">
			{issues.map((issue) => (
				<li key={`${issue.path}:${issue.message}`}>
					<code className="rounded-sm bg-monti-danger-muted px-1">{issue.path || "(root)"}</code> {issue.message}
				</li>
			))}
		</ul>
	);
}

export function TextInput({
	label,
	value,
	onChange,
	placeholder,
	description,
	hint,
	type = "text",
	className,
	optional,
	disabled: customDisabled,
	revert,
}: {
	label: string;
	/** Puts the saved value back; given only while the field differs from the saved file. */
	revert?: () => void;
	value: string | number | undefined;
	onChange: (value: string) => void;
	placeholder?: string;
	description?: ReactNode;
	hint?: ReactNode;
	type?: "text" | "number";
	className?: string;
	/** Marks the field as optional with a muted "optional" next to the label (the form marks what is optional, not what is required). */
	optional?: boolean;
	disabled?: boolean;
}) {
	const t = useTranslator(schemaMessages);
	const id = useId();
	const { disabled } = useSchemaEdit();
	const isDisabled = disabled || customDisabled;
	return (
		<Labeled
			label={
				optional ? (
					<>
						{label} <span className="font-normal text-monti-muted">{t("sheet.optional")}</span>
					</>
				) : (
					label
				)
			}
			description={description}
			hint={hint}
			htmlFor={id}
			className={className}
			aside={revert && <RevertMark name={label} onRevert={revert} />}
		>
			<Input
				id={id}
				type={type}
				min={type === "number" ? 1 : undefined}
				value={value ?? ""}
				placeholder={placeholder}
				disabled={isDisabled}
				onChange={(event) => onChange(event.target.value)}
			/>
		</Labeled>
	);
}

/** A text value that is `undefined` when empty (an optional property of the file). */
export const orUndefined = (value: string): string | undefined => (value === "" ? undefined : value);
export const countOrUndefined = (value: string): number | undefined => {
	const count = Number.parseInt(value, 10);
	return Number.isFinite(count) && count > 0 ? count : undefined;
};

export function FlagSwitch({
	label,
	checked,
	onChange,
	description,
	hint,
	className,
	locked,
	revert,
}: {
	label: string;
	/** Puts the saved value back; given only while the switch differs from the saved file. */
	revert?: () => void;
	checked: boolean;
	onChange: (value: boolean) => void;
	description?: ReactNode;
	hint?: ReactNode;
	className?: string;
	/** The switch cannot be changed here (the value is fixed by something else): shown as it is, disabled. */
	locked?: boolean;
}) {
	const id = useId();
	const { disabled: readOnly } = useSchemaEdit();
	const disabled = readOnly || locked === true;
	const desc = description ?? hint;
	return (
		<UiField orientation="horizontal" className={cn("w-full items-start justify-between gap-4", className)}>
			<div className="flex flex-col gap-0.5">
				<FormFieldLabel htmlFor={id} className="font-medium text-monti-body">
					{label}
				</FormFieldLabel>
				{desc && <FormFieldDescription className={HELP}>{desc}</FormFieldDescription>}
			</div>
			<div className="flex shrink-0 items-center gap-2">
				{revert && <RevertMark name={label} onRevert={revert} />}
				<Switch
					id={id}
					size="sm"
					checked={checked}
					disabled={disabled}
					className="mt-0.5 shrink-0"
					onCheckedChange={(next) => onChange(next === true)}
				/>
			</div>
		</UiField>
	);
}

/** A few exclusive choices side by side in one strip with soft ends (a segmented control). */
export function Segmented({
	label,
	value,
	items,
	onChange,
	description,
	hint,
}: {
	label: string;
	value: string;
	items: readonly PickItem[];
	onChange: (value: string) => void;
	description?: ReactNode;
	hint?: ReactNode;
}) {
	const { disabled } = useSchemaEdit();
	const id = useId();
	return (
		<UiField className="gap-2">
			<FormFieldLabel id={id} className="font-medium text-monti-body">
				{label}
			</FormFieldLabel>
			{description && <FormFieldDescription className={HELP}>{description}</FormFieldDescription>}
			<div
				role="radiogroup"
				aria-labelledby={id}
				className="flex w-fit max-w-full flex-wrap gap-0.5 rounded-md bg-monti-neutral p-[3px] text-monti-body"
			>
				{items.map((item) => (
					// biome-ignore lint/a11y/useSemanticElements: a segmented control draws radio buttons as buttons; a native radio cannot be styled as one strip
					<button
						key={item.value}
						type="button"
						role="radio"
						aria-checked={item.value === value}
						disabled={disabled}
						onClick={() => onChange(item.value)}
						className={cn(
							"h-7 rounded-sm border border-transparent px-3 text-monti-muted outline-none transition-colors focus-visible:ring-2 focus-visible:ring-monti-focus-soft disabled:opacity-50",
							item.value === value && "border-monti-muted bg-monti-page font-medium text-monti-default",
						)}
					>
						{item.label}
					</button>
				))}
			</div>
			{hint && <FormFieldDescription className={HELP}>{hint}</FormFieldDescription>}
		</UiField>
	);
}

export interface PickItem {
	readonly value: string;
	readonly label: string;
	/** A muted line under the label in the list of choices (the closed select shows the label only). */
	readonly description?: string;
}

export function Pick({
	label,
	value,
	items,
	onChange,
	description,
	hint,
	className,
	disabled: customDisabled,
	control = "narrow",
	size = "default",
	revert,
}: {
	label: string;
	/** Puts the saved value back; given only while the choice differs from the saved file. */
	revert?: () => void;
	value: string;
	items: readonly PickItem[];
	onChange: (value: string) => void;
	description?: ReactNode;
	hint?: ReactNode;
	className?: string;
	disabled?: boolean;
	control?: keyof typeof CONTROL_WIDTH;
	size?: "sm" | "default";
}) {
	const id = useId();
	const { disabled } = useSchemaEdit();
	const isDisabled = disabled || customDisabled;
	return (
		<Labeled
			label={label}
			description={description}
			hint={hint}
			htmlFor={id}
			className={className}
			control={control}
			aside={revert && <RevertMark name={label} onRevert={revert} />}
		>
			<Select
				value={value}
				items={items as PickItem[]}
				disabled={isDisabled}
				onValueChange={(next) => typeof next === "string" && onChange(next)}
			>
				<SelectTrigger id={id} size={size} className="w-full" aria-label={label}>
					<SelectValue />
				</SelectTrigger>
				<SelectContent>
					{items.map((item) => (
						<SelectItem key={item.value} value={item.value}>
							{item.description ? (
								<span className="flex flex-col gap-0.5">
									<span>{item.label}</span>
									<span className="whitespace-normal text-monti-caption text-monti-muted">{item.description}</span>
								</span>
							) : (
								item.label
							)}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
		</Labeled>
	);
}

/**
 * An input for a name (a field, an option, a collection): the change is taken when the writer leaves the input or presses Enter, and a name that cannot be used
 * is refused with the reason, so a half-typed name never renames anything.
 */
export function NameInput({
	label,
	value,
	taken,
	onCommit,
	disabled: forcedDisabled,
	className,
	description,
	hint,
}: {
	label: string;
	value: string;
	/** The other names it must differ from. */
	taken: readonly string[];
	onCommit: (name: string) => void;
	disabled?: boolean;
	className?: string;
	description?: ReactNode;
	hint?: ReactNode;
}) {
	const t = useTranslator(schemaMessages);
	const id = useId();
	const { disabled } = useSchemaEdit();
	const [text, setText] = useState(value);
	const [shown, setShown] = useState(value);
	if (shown !== value) {
		setShown(value);
		setText(value);
	}
	const problem = text === value ? null : nameProblem(text, taken);
	const commit = () => {
		if (text === value) return;
		if (nameProblem(text, taken)) {
			setText(value);
			return;
		}
		onCommit(text);
	};
	return (
		<Labeled label={label} htmlFor={id} className={className} description={description} hint={hint}>
			<Input
				id={id}
				value={text}
				disabled={disabled || forcedDisabled}
				aria-invalid={problem ? true : undefined}
				onChange={(event) => setText(event.target.value)}
				onBlur={commit}
				onKeyDown={(event) => {
					if (event.key === "Enter") {
						event.preventDefault();
						commit();
					}
				}}
			/>
			{problem && <FormFieldError className="text-monti-caption">{t(`name.${problem}`)}</FormFieldError>}
		</Labeled>
	);
}

/** Up, down and remove buttons of one row of a list. */
export function RowActions({
	index,
	count,
	onMove,
	onRemove,
	name,
	removeBlocked,
}: {
	index: number;
	count: number;
	onMove: (delta: number) => void;
	onRemove: () => void;
	name: string;
	/** Why the row cannot be removed: the remove button is disabled and the reason is its tooltip. */
	removeBlocked?: string;
}) {
	const t = useTranslator(schemaMessages);
	const { disabled } = useSchemaEdit();
	return (
		<div className="flex shrink-0 items-center">
			<IconButton
				label={t("row.up", { name })}
				size="icon-xs"
				disabled={disabled || index === 0}
				onClick={() => onMove(-1)}
			>
				<ArrowUp aria-hidden />
			</IconButton>
			<IconButton
				label={t("row.down", { name })}
				size="icon-xs"
				disabled={disabled || index === count - 1}
				onClick={() => onMove(1)}
			>
				<ArrowDown aria-hidden />
			</IconButton>
			{removeBlocked ? (
				<Tooltip>
					{/* A disabled button gets no pointer events, so the tooltip hangs on a wrapper that can also take focus. */}
					{/* biome-ignore lint/a11y/noNoninteractiveTabindex: keyboard users reach the reason through this wrapper; the button inside is disabled */}
					<TooltipTrigger render={<span tabIndex={0} data-testid="remove-blocked" />}>
						<Button
							type="button"
							variant="ghost"
							size="icon-xs"
							disabled
							aria-label={t("row.remove", { name })}
							aria-description={removeBlocked}
							className="pointer-events-none text-monti-danger"
						>
							<X aria-hidden />
						</Button>
					</TooltipTrigger>
					<TooltipContent side="top">{removeBlocked}</TooltipContent>
				</Tooltip>
			) : (
				<IconButton
					label={t("row.remove", { name })}
					size="icon-xs"
					tone="danger"
					disabled={disabled}
					onClick={onRemove}
				>
					<X aria-hidden />
				</IconButton>
			)}
		</div>
	);
}
