"use client";

import { useTranslator } from "@monti-cms/core/site";
import { useId, useState } from "react";
import { useAdminComponents } from "../../admin-components";
import type { TranslatorFor } from "../../translator";
import { FormFieldError } from "../../ui/field";
import { Textarea } from "../../ui/textarea";
import { Labeled } from "../shared/labeled";
import { orUndefined, Pick, type PickItem, TextInput, useSchemaEdit } from "./controls";
import { schemaFieldsMessages } from "./fields.messages";
import { type FieldKindName, isObj, type Obj } from "./schema-model";

const ROLE_NONE = "none";
const ROLE_CUSTOM = "__custom__";

type FieldMessageKey = Parameters<TranslatorFor<typeof schemaFieldsMessages>>[0];

interface KnownRole {
	readonly role: string;
	readonly labelKey: FieldMessageKey;
	readonly descKey: FieldMessageKey;
	readonly kinds?: readonly FieldKindName[];
}

const KNOWN_ROLES: readonly KnownRole[] = [
	{
		role: "title",
		labelKey: "field.roleTitle",
		descKey: "field.roleTitleDesc",
		kinds: ["text"],
	},
	{
		role: "summary",
		labelKey: "field.roleSummary",
		descKey: "field.roleSummaryDesc",
		kinds: ["text"],
	},
	{
		role: "seoTitle",
		labelKey: "field.roleSeoTitle",
		descKey: "field.roleSeoTitleDesc",
		kinds: ["text"],
	},
	{
		role: "seoDescription",
		labelKey: "field.roleSeoDescription",
		descKey: "field.roleSeoDescriptionDesc",
		kinds: ["text"],
	},
	{
		role: "canonical",
		labelKey: "field.roleCanonical",
		descKey: "field.roleCanonicalDesc",
		kinds: ["text"],
	},
	{
		role: "ogImage",
		labelKey: "field.roleOgImage",
		descKey: "field.roleOgImageDesc",
		kinds: ["media"],
	},
	{
		role: "noindex",
		labelKey: "field.roleNoindex",
		descKey: "field.roleNoindexDesc",
		kinds: ["select"],
	},
];

export function FieldRolePicker({
	role,
	kind,
	isTitle,
	disabled,
	onChange,
}: {
	role: string | undefined;
	kind: FieldKindName;
	isTitle?: boolean;
	disabled?: boolean;
	onChange: (role: string | undefined) => void;
}) {
	const t = useTranslator(schemaFieldsMessages);
	const [customActive, setCustomActive] = useState(false);

	if (isTitle) {
		return (
			<Pick
				label={t("field.role")}
				description={t("field.roleFixedTitleHint")}
				value="title"
				disabled
				items={[
					{
						value: "title",
						label: t("field.roleTitle"),
						description: t("field.roleTitleDesc"),
					},
				]}
				onChange={() => undefined}
			/>
		);
	}

	const matchingRoles = KNOWN_ROLES.filter((item) => !item.kinds || item.kinds.includes(kind));
	const isKnown = matchingRoles.some((item) => item.role === role);
	const isCustom = !isKnown && typeof role === "string" && role.length > 0;
	const selectedValue = isCustom || customActive ? ROLE_CUSTOM : (role ?? ROLE_NONE);

	const items: PickItem[] = [
		{
			value: ROLE_NONE,
			label: t("field.roleNone"),
			description: t("field.roleNoneDesc"),
		},
		...matchingRoles.map((item) => ({
			value: item.role,
			label: t(item.labelKey),
			description: t(item.descKey),
		})),
		{
			value: ROLE_CUSTOM,
			label: t("field.roleCustom"),
			description: t("field.roleCustomDesc"),
		},
	];

	return (
		<div className="flex flex-col gap-3">
			<Pick
				label={t("field.role")}
				description={t("field.roleHint")}
				value={selectedValue}
				disabled={disabled}
				items={items}
				onChange={(next) => {
					if (next === ROLE_NONE) {
						setCustomActive(false);
						onChange(undefined);
					} else if (next === ROLE_CUSTOM) {
						setCustomActive(true);
					} else {
						setCustomActive(false);
						onChange(next);
					}
				}}
			/>
			{(selectedValue === ROLE_CUSTOM || customActive) && (
				<TextInput
					label={t("field.roleCustomName")}
					value={role}
					disabled={disabled}
					placeholder="roleName"
					onChange={(val) => onChange(orUndefined(val))}
				/>
			)}
		</div>
	);
}

export function InputOptionsEditor({
	value,
	onChange,
}: {
	value: unknown;
	onChange: (value: Obj | undefined) => void;
}) {
	const t = useTranslator(schemaFieldsMessages);
	const id = useId();
	const { disabled } = useSchemaEdit();
	const [text, setText] = useState(isObj(value) ? JSON.stringify(value) : "");
	const [bad, setBad] = useState(false);
	const commit = () => {
		if (text.trim() === "") {
			setBad(false);
			onChange(undefined);
			return;
		}
		try {
			const parsed: unknown = JSON.parse(text);
			const ok =
				isObj(parsed) && Object.values(parsed).every((item) => ["string", "number", "boolean"].includes(typeof item));
			setBad(!ok);
			if (ok) onChange(parsed as Obj);
		} catch {
			setBad(true);
		}
	};
	return (
		<Labeled label={t("field.inputOptions")} htmlFor={id} description={t("field.inputOptionsHint")}>
			<Textarea
				id={id}
				rows={2}
				value={text}
				disabled={disabled}
				aria-invalid={bad || undefined}
				className="font-mono text-monti-caption"
				onChange={(event) => setText(event.target.value)}
				onBlur={commit}
			/>
			{bad && <FormFieldError>{t("field.inputOptionsBad")}</FormFieldError>}
		</Labeled>
	);
}

export function FieldCustomInputPicker({
	value,
	options,
	disabled,
	onChangeInput,
	onChangeOptions,
}: {
	value: string | undefined;
	options: unknown;
	disabled?: boolean;
	onChangeInput: (input: string | undefined) => void;
	onChangeOptions: (options: Obj | undefined) => void;
}) {
	const t = useTranslator(schemaFieldsMessages);
	const { fieldInputs } = useAdminComponents();
	const registered = Object.keys(fieldInputs ?? {});
	const [customActive, setCustomActive] = useState(false);

	const isRegistered = typeof value === "string" && registered.includes(value);
	const isCustom = typeof value === "string" && value.length > 0 && !isRegistered;
	const selectedValue = isCustom || customActive ? ROLE_CUSTOM : (value ?? ROLE_NONE);

	const items: PickItem[] = [
		{
			value: ROLE_NONE,
			label: t("field.inputDefault"),
			description: t("field.inputDefaultDesc"),
		},
		...registered.map((name) => ({
			value: name,
			label: name,
		})),
		{
			value: ROLE_CUSTOM,
			label: t("field.roleCustom"),
			description: t("field.inputCustomDesc"),
		},
	];

	return (
		<div className="flex flex-col gap-4">
			{registered.length > 0 ? (
				<Pick
					label={t("field.input")}
					description={t("field.inputHint")}
					value={selectedValue}
					disabled={disabled}
					items={items}
					onChange={(next) => {
						if (next === ROLE_NONE) {
							setCustomActive(false);
							onChangeInput(undefined);
						} else if (next === ROLE_CUSTOM) {
							setCustomActive(true);
						} else {
							setCustomActive(false);
							onChangeInput(next);
						}
					}}
				/>
			) : (
				<TextInput
					label={t("field.input")}
					description={t("field.inputHint")}
					optional
					value={value}
					disabled={disabled}
					onChange={(val) => onChangeInput(orUndefined(val))}
				/>
			)}
			{registered.length > 0 && (selectedValue === ROLE_CUSTOM || customActive) && (
				<TextInput
					label={t("field.inputCustomName")}
					value={value}
					disabled={disabled}
					placeholder="inputName"
					onChange={(val) => onChangeInput(orUndefined(val))}
				/>
			)}
			<InputOptionsEditor value={options} onChange={onChangeOptions} />
		</div>
	);
}
