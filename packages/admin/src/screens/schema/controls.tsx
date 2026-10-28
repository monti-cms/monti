"use client";

import { ArrowDown, ArrowUp, Close, Undo } from "@carbon/icons-react";
import type { ConfigIssue } from "@monti-cms/core/site";
import { useTranslator } from "@monti-cms/core/site";
import {
	Box,
	ChangeDot,
	FormFieldError,
	IconButton,
	Inline,
	Input,
	Segmented,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
	Stack,
	Switch,
	Text,
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@monti-cms/ui";
import { createContext, type ReactNode, useContext, useId, useState } from "react";
import { type ControlWidth, Labeled } from "../shared/labeled";
import type { DraftProblem } from "./draft-problems";
import { schemaMessages } from "./messages";
import { nameProblem, type Obj, sameJson, sectionOf } from "./schema-model";

/** What every editor of the screen reads: whether the screen is read-only, the vocabulary of body lists, and the problems of the last check. */
export interface SchemaEditContext {
	readonly disabled: boolean;
	readonly vocabulary: { readonly blocks: readonly string[]; readonly marks: readonly string[] };
	readonly issues: readonly ConfigIssue[];
	/** What stops the draft from being saved; each editor shows the ones that are under its fields. */
	readonly problems: readonly DraftProblem[];
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
	problems: [],
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

/** A small dot that says "this has changes", named for a screen reader. */
export function ChangedMark() {
	const t = useTranslator(schemaMessages);
	return <ChangeDot label={t("changed")} />;
}

/** A help text under a label or a control: a muted line that stays readable in width. */
export function Help({ children }: { children: ReactNode }) {
	return (
		<Box maxWidth="reading">
			<Text as="p" variant="label" tone="muted">
				{children}
			</Text>
		</Box>
	);
}

/** The marker of a field that differs from the saved file, with the button that puts the saved value back. Shown only while the field is changed. */
export function RevertMark({ name, onRevert }: { name: string; onRevert: () => void }) {
	const t = useTranslator(schemaMessages);
	const { disabled } = useSchemaEdit();
	return (
		<Inline as="span" gap={2} data-testid="field-changed">
			<ChangedMark />
			<IconButton label={t("revert.named", { name })} disabled={disabled} onClick={onRevert}>
				<Undo aria-hidden />
			</IconButton>
		</Inline>
	);
}

export function IssueList({ issues }: { issues: readonly ConfigIssue[] }) {
	if (issues.length === 0) return null;
	return (
		<Stack as="ul" gap={2} data-testid="schema-issues">
			{issues.map((issue) => (
				<Text as="li" variant="caption" tone="danger" key={`${issue.path}:${issue.message}`}>
					<Box as="span" background="danger-muted" radius="sm" paddingX={4}>
						<Text as="code">{issue.path || "(root)"}</Text>
					</Box>{" "}
					{issue.message}
				</Text>
			))}
		</Stack>
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
						{label} <Text tone="muted">{t("sheet.optional")}</Text>
					</>
				) : (
					label
				)
			}
			description={description}
			hint={hint}
			htmlFor={id}
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
	/** The switch cannot be changed here (the value is fixed by something else): shown as it is, disabled. */
	locked?: boolean;
}) {
	const id = useId();
	const { disabled: readOnly } = useSchemaEdit();
	const disabled = readOnly || locked === true;
	const desc = description ?? hint;
	return (
		<Box maxWidth="reading">
			<Inline align="center" justify="between" gap={16}>
				<Stack gap={2}>
					<Text as="label" htmlFor={id} weight="medium">
						{label}
					</Text>
					{desc && <Help>{desc}</Help>}
				</Stack>
				<Inline gap={8} shrink={false}>
					{revert && <RevertMark name={label} onRevert={revert} />}
					<Switch id={id} checked={checked} disabled={disabled} onCheckedChange={(next) => onChange(next === true)} />
				</Inline>
			</Inline>
		</Box>
	);
}

/** A few exclusive choices side by side, with the field's name above: the design system's `Segmented` in a labeled row. */
export function SegmentedField({
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
		<Stack gap={8}>
			<Text as="label" id={id} weight="medium">
				{label}
			</Text>
			{description && <Help>{description}</Help>}
			<Segmented
				aria-label={label}
				inline
				disabled={disabled}
				value={value}
				onValueChange={onChange}
				options={items.map((item) => ({ value: item.value, label: item.label }))}
			/>
			{hint && <Help>{hint}</Help>}
		</Stack>
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
	disabled?: boolean;
	control?: ControlWidth;
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
			control={control}
			aside={revert && <RevertMark name={label} onRevert={revert} />}
		>
			<Select
				value={value}
				items={items as PickItem[]}
				disabled={isDisabled}
				onValueChange={(next) => typeof next === "string" && onChange(next)}
			>
				<SelectTrigger id={id} size={size} width="full" aria-label={label}>
					<SelectValue />
				</SelectTrigger>
				<SelectContent>
					{items.map((item) => (
						<SelectItem key={item.value} value={item.value}>
							{item.description ? (
								<Stack gap={2}>
									<Text>{item.label}</Text>
									<Text variant="caption" tone="muted">
										{item.description}
									</Text>
								</Stack>
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
	description,
	hint,
}: {
	label: string;
	value: string;
	/** The other names it must differ from. */
	taken: readonly string[];
	onCommit: (name: string) => void;
	disabled?: boolean;
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
		<Labeled label={label} htmlFor={id} description={description} hint={hint}>
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
			{problem && <FormFieldError>{t(`name.${problem}`)}</FormFieldError>}
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
		<Inline gap={0} shrink={false}>
			<IconButton label={t("row.up", { name })} disabled={disabled || index === 0} onClick={() => onMove(-1)}>
				<ArrowUp aria-hidden />
			</IconButton>
			<IconButton label={t("row.down", { name })} disabled={disabled || index === count - 1} onClick={() => onMove(1)}>
				<ArrowDown aria-hidden />
			</IconButton>
			{removeBlocked ? (
				<Tooltip>
					{/* A disabled button gets no pointer events, so the tooltip hangs on a wrapper that can also take focus. */}
					{/* biome-ignore lint/a11y/noNoninteractiveTabindex: keyboard users reach the reason through this wrapper; the button inside is disabled */}
					<TooltipTrigger render={<span tabIndex={0} data-testid="remove-blocked" />}>
						<IconButton label={t("row.remove", { name })} tone="danger" disabled aria-description={removeBlocked}>
							<Close aria-hidden />
						</IconButton>
					</TooltipTrigger>
					<TooltipContent side="top">{removeBlocked}</TooltipContent>
				</Tooltip>
			) : (
				<IconButton label={t("row.remove", { name })} tone="danger" disabled={disabled} onClick={onRemove}>
					<Close aria-hidden />
				</IconButton>
			)}
		</Inline>
	);
}
