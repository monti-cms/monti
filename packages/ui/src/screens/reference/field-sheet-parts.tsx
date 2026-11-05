import type * as React from "react";
import { FormField, FormFieldLabel, Input, Option, ReadValue, Stack, Switch, Text, Textarea } from "../../index";
import { ShownSelect } from "./settings";

/** A rule row of the field sheet: its name on the left, its control at the end, at the sheet's height (32px). */
export function RuleRow({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
	return (
		<Option spread height="md">
			{label}
			{children}
		</Option>
	);
}

/** A rule row that is on or off. */
export function SwitchRule({ label, checked = false }: { label: React.ReactNode; checked?: boolean }) {
	return (
		<RuleRow label={label}>
			<Switch checked={checked} />
		</RuleRow>
	);
}

/** A rule row with a few values: a select at the end of the row. */
export function PickRule({ label, value }: { label: React.ReactNode; value: string }) {
	return (
		<RuleRow label={label}>
			<ShownSelect value={value} width="fit" size="md" label={typeof label === "string" ? label : undefined} />
		</RuleRow>
	);
}

/** "필수 !": the mark the field list shows for a required field, faint after the word. */
export const REQUIRED = (
	<span>
		필수{" "}
		<Text tone="faint" mono>
			!
		</Text>
	</span>
);

/**
 * The top of the field sheet: (a saved field's kind), the identifier it must have, the label over it (the identifier while empty), and what the
 * assistant should know about it.
 */
export function FieldAbout({
	kind,
	name,
	label,
	about,
}: {
	kind?: string;
	name: string;
	label?: string;
	about?: string;
}) {
	return (
		<Stack gap={20}>
			{kind ? (
				<ReadValue label="종류" mono={false}>
					{kind}
				</ReadValue>
			) : null}
			<FormField>
				<FormFieldLabel htmlFor="field-name" required>
					식별자
				</FormFieldLabel>
				<Input id="field-name" mono defaultValue={name} />
			</FormField>
			<FormField>
				<FormFieldLabel htmlFor="field-label">표시 이름</FormFieldLabel>
				<Input id="field-label" placeholder={name} defaultValue={label} />
			</FormField>
			<FormField>
				<FormFieldLabel htmlFor="field-about">✦ 설명</FormFieldLabel>
				<Textarea id="field-about" tall placeholder="AI에게 알려 줄 이 필드의 용도와 규칙" defaultValue={about} />
			</FormField>
		</Stack>
	);
}
