"use client";

import { cn, Input, Textarea } from "@monti-cms/admin/kit";
import {
	createTranslator,
	DEFAULT_LOCALE,
	isUuid,
	LOCALES,
	localeLabel,
	PREFIXED_LOCALES,
} from "@monti-cms/core/client";
import type { AiInputKind } from "../action";
import type { AiActionView } from "../actions";
import { aiCommonMessages } from "./ai-common.messages";
import type { AiRunEnv } from "./ai-slot-provider";
import { OptionSelect } from "./custom-editor";

const t = createTranslator(aiCommonMessages);

/**
 * Sample input for the AI screen's Test. Shows one field of the matching kind for each input in the action definition (input names are not shown).
 * - text, MDX, code: multi-line field; current value: single-line field; image: media ID or site path; language: language picker from the site config
 */

export interface SampleField {
	readonly name: string;
	readonly kind: AiInputKind;
	readonly label: string;
	readonly required: boolean;
}

type SampleFeature = Pick<AiActionView, "input" | "engine" | "attach">;

/** Fields shown in the test: inputs to send (including required ones) and language inputs (which go into the instructions). The judge mode does not read images. */
export function sampleFields(feature: SampleFeature, send: readonly string[]): SampleField[] {
	return Object.entries(feature.input).flatMap(([name, input]) => {
		if (feature.engine === "decide" && input.kind === "image") return [];
		if (input.kind !== "locale" && !input.required && !send.includes(name)) return [];
		return [{ name, kind: input.kind, label: input.label, required: input.required }];
	});
}

/** Initial value of a field. The first language input is the default language; the next language input is the first non-default language (source -> target). */
export function sampleDefaults(feature: Pick<AiActionView, "input">): Record<string, string> {
	const defaults: Record<string, string> = {};
	let locales = 0;
	for (const [name, input] of Object.entries(feature.input)) {
		if (input.kind !== "locale") continue;
		defaults[name] = locales++ === 0 ? DEFAULT_LOCALE : (PREFIXED_LOCALES[0] ?? DEFAULT_LOCALE);
	}
	return defaults;
}

/** Current value of a field. If never edited, it is the initial value. */
export const sampleValue = (
	values: Readonly<Record<string, string>>,
	defaults: Readonly<Record<string, string>>,
	name: string,
) => values[name] ?? defaults[name] ?? "";

/** Whether any required field is empty (if so, it does not run). */
export const missingRequired = (
	fields: readonly SampleField[],
	values: Readonly<Record<string, string>>,
	defaults: Readonly<Record<string, string>>,
) => fields.some((field) => field.required && !sampleValue(values, defaults, field.name).trim());

/**
 * Builds the run input and common information from the test values. Empty fields are not sent. A field-slot action runs with the first collection, and a translation-slot action with
 * the target language (`to`, an input the translation slot provides).
 */
export function sampleRun(
	feature: SampleFeature,
	fields: readonly SampleField[],
	values: Readonly<Record<string, string>>,
	defaults: Readonly<Record<string, string>> = {},
): { input: Record<string, unknown>; env: AiRunEnv } {
	const input: Record<string, unknown> = {};
	for (const field of fields) {
		const value = sampleValue(values, defaults, field.name);
		if (!value.trim()) continue;
		if (field.kind === "image") {
			const location = value.trim();
			input[field.name] = isUuid(location) ? { mediaId: location } : { src: location };
		} else input[field.name] = value;
	}
	const env: AiRunEnv = {};
	const field = feature.attach.find((attach) => attach.slot === "field");
	const collection = field?.slot === "field" ? field.collections?.[0] : undefined;
	if (collection) env.collection = collection;
	const target = input.to;
	if (feature.attach.some((attach) => attach.slot === "translation") && typeof target === "string") {
		env.locale = target;
	}
	return { input, env };
}

const LOCALE_OPTIONS = LOCALES.map((locale) => ({ value: locale, label: localeLabel(locale) }));

/** Test fields. A field's name (aria-label, placeholder) is the input's label. */
export function SampleInputs({
	fields,
	values,
	defaults,
	onChange,
}: {
	fields: readonly SampleField[];
	values: Readonly<Record<string, string>>;
	defaults: Readonly<Record<string, string>>;
	onChange: (name: string, value: string) => void;
}) {
	return fields.map((field) => {
		const value = sampleValue(values, defaults, field.name);
		const common = {
			"aria-label": field.label,
			placeholder: field.kind === "image" ? t("sampleMediaId", { label: field.label }) : field.label,
			value,
		};
		switch (field.kind) {
			case "locale":
				return (
					<OptionSelect
						key={field.name}
						aria-label={field.label}
						value={value}
						options={LOCALE_OPTIONS}
						onChange={(next) => onChange(field.name, next)}
						className="w-auto self-start bg-cms-background"
					/>
				);
			case "image":
			case "value":
				return (
					<Input
						key={field.name}
						{...common}
						onChange={(event) => onChange(field.name, event.target.value)}
						className={cn("h-8 bg-cms-background text-xs md:text-xs", field.kind === "image" && "font-mono")}
					/>
				);
			default:
				return (
					<Textarea
						key={field.name}
						{...common}
						rows={field.kind === "text" ? 2 : 4}
						onChange={(event) => onChange(field.name, event.target.value)}
						className={cn("bg-cms-background text-xs md:text-xs", field.kind !== "text" && "font-mono")}
					/>
				);
		}
	});
}
