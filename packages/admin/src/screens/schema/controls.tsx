"use client";

import { useTranslator } from "@monti-cms/core/client";
import type { SchemaIssue } from "@monti-cms/core/schema-edit";
import { ArrowDown, ArrowUp, Plus, X } from "lucide-react";
import { createContext, type ReactNode, useContext, useId, useState } from "react";
import { cn } from "../../lib/utils/cn";
import { Button } from "../../ui/button";
import { FieldDescription, FieldError, FieldLabel, Field as UiField } from "../../ui/field";
import { IconButton } from "../../ui/icon-button";
import { Input } from "../../ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../ui/select";
import { Switch } from "../../ui/switch";
import { schemaMessages } from "./messages";
import { moveItem, nameProblem, type Obj } from "./schema-model";

/** What every editor of the screen reads: whether the screen is read-only, the vocabulary of body lists, and the problems of the last check. */
export interface SchemaEditContext {
	readonly disabled: boolean;
	readonly vocabulary: { readonly blocks: readonly string[]; readonly marks: readonly string[] };
	readonly issues: readonly SchemaIssue[];
	readonly collectionNames: readonly string[];
	/** The file as edited, for editors that look at another collection (a relation's target, a backlink's relation). */
	readonly file: Obj;
}

const Context = createContext<SchemaEditContext>({
	disabled: true,
	vocabulary: { blocks: [], marks: [] },
	issues: [],
	collectionNames: [],
	file: {},
});
export const SchemaEditProvider = Context.Provider;
export const useSchemaEdit = () => useContext(Context);

/** The problems of the last check at `path` or below it. */
export function useIssuesUnder(path: string, exclude?: string): readonly SchemaIssue[] {
	const { issues } = useSchemaEdit();
	return issues.filter(
		(issue) =>
			(issue.path === path || issue.path.startsWith(`${path}.`) || issue.path.startsWith(`${path}[`)) &&
			!(exclude && issue.path.startsWith(`${path}${exclude}`)),
	);
}

export function IssueList({ issues }: { issues: readonly SchemaIssue[] }) {
	if (issues.length === 0) return null;
	return (
		<ul className="flex flex-col gap-0.5 text-cms-destructive text-xs" data-testid="schema-issues">
			{issues.map((issue) => (
				<li key={`${issue.path}:${issue.message}`}>
					<code className="rounded bg-cms-destructive/10 px-1">{issue.path || "(root)"}</code> {issue.message}
				</li>
			))}
		</ul>
	);
}

export function Labeled({
	label,
	hint,
	children,
	htmlFor,
	className,
}: {
	label: ReactNode;
	hint?: ReactNode;
	htmlFor?: string;
	children: ReactNode;
	className?: string;
}) {
	return (
		<UiField className={cn("gap-1.5", className)}>
			<FieldLabel htmlFor={htmlFor} className="font-medium text-xs">
				{label}
			</FieldLabel>
			{children}
			{hint && <FieldDescription className="text-xs">{hint}</FieldDescription>}
		</UiField>
	);
}

export function TextInput({
	label,
	value,
	onChange,
	placeholder,
	hint,
	type = "text",
	className,
}: {
	label: string;
	value: string | number | undefined;
	onChange: (value: string) => void;
	placeholder?: string;
	hint?: ReactNode;
	type?: "text" | "number";
	className?: string;
}) {
	const id = useId();
	const { disabled } = useSchemaEdit();
	return (
		<Labeled label={label} hint={hint} htmlFor={id} className={className}>
			<Input
				id={id}
				type={type}
				min={type === "number" ? 1 : undefined}
				value={value ?? ""}
				placeholder={placeholder}
				disabled={disabled}
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
	hint,
}: {
	label: string;
	checked: boolean;
	onChange: (value: boolean) => void;
	hint?: ReactNode;
}) {
	const id = useId();
	const { disabled } = useSchemaEdit();
	return (
		<UiField orientation="horizontal" className="items-start gap-2">
			<Switch
				id={id}
				size="sm"
				checked={checked}
				disabled={disabled}
				onCheckedChange={(next) => onChange(next === true)}
			/>
			<div className="flex flex-col gap-0.5">
				<FieldLabel htmlFor={id} className="font-normal text-sm">
					{label}
				</FieldLabel>
				{hint && <FieldDescription className="text-xs">{hint}</FieldDescription>}
			</div>
		</UiField>
	);
}

export interface PickItem {
	readonly value: string;
	readonly label: string;
}

export function Pick({
	label,
	value,
	items,
	onChange,
	hint,
	className,
}: {
	label: string;
	value: string;
	items: readonly PickItem[];
	onChange: (value: string) => void;
	hint?: ReactNode;
	className?: string;
}) {
	const id = useId();
	const { disabled } = useSchemaEdit();
	return (
		<Labeled label={label} hint={hint} htmlFor={id} className={className}>
			<Select
				value={value}
				items={items as PickItem[]}
				disabled={disabled}
				onValueChange={(next) => typeof next === "string" && onChange(next)}
			>
				<SelectTrigger id={id} size="sm" className="w-full" aria-label={label}>
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
	hint,
}: {
	label: string;
	value: string;
	/** The other names it must differ from. */
	taken: readonly string[];
	onCommit: (name: string) => void;
	disabled?: boolean;
	className?: string;
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
		<Labeled label={label} htmlFor={id} className={className} hint={hint}>
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
			{problem && <FieldError className="text-xs">{t(`name.${problem}`)}</FieldError>}
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
}: {
	index: number;
	count: number;
	onMove: (delta: number) => void;
	onRemove: () => void;
	name: string;
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
			<IconButton label={t("row.remove", { name })} size="icon-xs" destructive disabled={disabled} onClick={onRemove}>
				<X aria-hidden />
			</IconButton>
		</div>
	);
}

/** An ordered list of names picked from `options`: add from the options not in the list yet, move, remove. Used for layout groups and list columns. */
export function OrderedNames({
	label,
	names,
	options,
	onChange,
	nameOf,
}: {
	label: string;
	names: readonly string[];
	options: readonly string[];
	onChange: (names: string[]) => void;
	nameOf?: (name: string) => string;
}) {
	const t = useTranslator(schemaMessages);
	const { disabled } = useSchemaEdit();
	const rest = options.filter((name) => !names.includes(name));
	const [adding, setAdding] = useState("");
	const show = nameOf ?? ((name: string) => name);
	return (
		<div className="flex flex-col gap-1.5">
			<span className="font-medium text-xs">{label}</span>
			{names.length === 0 && <p className="text-cms-muted-foreground text-xs">{t("names.none")}</p>}
			<ul className="flex flex-col gap-1">
				{names.map((name, index) => (
					<li
						key={name}
						className="flex items-center justify-between rounded-md border bg-cms-background px-2 py-0.5 text-sm"
					>
						<span className="truncate">{show(name)}</span>
						<RowActions
							index={index}
							count={names.length}
							name={show(name)}
							onMove={(delta) => onChange(moveItem(names, index, delta))}
							onRemove={() => onChange(names.filter((item) => item !== name))}
						/>
					</li>
				))}
			</ul>
			{rest.length > 0 && !disabled && (
				<div className="flex items-center gap-1.5">
					<Select
						value={adding}
						items={rest.map((name) => ({ value: name, label: show(name) }))}
						onValueChange={(next) => {
							if (typeof next === "string" && next) {
								onChange([...names, next]);
								setAdding("");
							}
						}}
					>
						<SelectTrigger size="sm" className="w-full" aria-label={t("names.add", { label })}>
							<span className="flex items-center gap-1.5 text-cms-muted-foreground">
								<Plus aria-hidden className="size-3.5" />
								<SelectValue placeholder={t("names.addPlaceholder")} />
							</span>
						</SelectTrigger>
						<SelectContent>
							{rest.map((name) => (
								<SelectItem key={name} value={name}>
									{show(name)}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>
			)}
		</div>
	);
}

export function AddButton({
	children,
	onClick,
	disabled: off,
}: {
	children: ReactNode;
	onClick: () => void;
	disabled?: boolean;
}) {
	const { disabled } = useSchemaEdit();
	return (
		<Button type="button" variant="outline" size="sm" disabled={disabled || off} onClick={onClick}>
			<Plus aria-hidden />
			{children}
		</Button>
	);
}
