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
 * AI 화면 `시험`의 예시 입력. 기능 정의의 입력마다 종류에 맞는 칸을 하나씩 보인다(입력 이름은 보지 않는다).
 * - 글·MDX·코드: 여러 줄 칸, 현재 값: 한 줄 칸, 이미지: 미디어 ID 또는 사이트 경로, 언어: 사이트 설정의 언어 고르기
 */

export interface SampleField {
	readonly name: string;
	readonly kind: AiInputKind;
	readonly label: string;
	readonly required: boolean;
}

type SampleFeature = Pick<AiActionView, "input" | "engine" | "attach">;

/** 시험에 보일 칸: 보낼 입력(필수 입력 포함)과 언어 입력(지시문에 들어간다). 판단 방식은 이미지를 읽지 않는다. */
export function sampleFields(feature: SampleFeature, send: readonly string[]): SampleField[] {
	return Object.entries(feature.input).flatMap(([name, input]) => {
		if (feature.engine === "decide" && input.kind === "image") return [];
		if (input.kind !== "locale" && !input.required && !send.includes(name)) return [];
		return [{ name, kind: input.kind, label: input.label, required: input.required }];
	});
}

/** 칸의 처음 값. 첫 언어 입력은 기본 언어, 그다음 언어 입력은 기본 언어가 아닌 첫 언어다(원문 → 대상). */
export function sampleDefaults(feature: Pick<AiActionView, "input">): Record<string, string> {
	const defaults: Record<string, string> = {};
	let locales = 0;
	for (const [name, input] of Object.entries(feature.input)) {
		if (input.kind !== "locale") continue;
		defaults[name] = locales++ === 0 ? DEFAULT_LOCALE : (PREFIXED_LOCALES[0] ?? DEFAULT_LOCALE);
	}
	return defaults;
}

/** 칸의 지금 값. 고친 적 없으면 처음 값이다. */
export const sampleValue = (
	values: Readonly<Record<string, string>>,
	defaults: Readonly<Record<string, string>>,
	name: string,
) => values[name] ?? defaults[name] ?? "";

/** 비어 있는 필수 칸이 있는가(있으면 실행하지 않는다). */
export const missingRequired = (
	fields: readonly SampleField[],
	values: Readonly<Record<string, string>>,
	defaults: Readonly<Record<string, string>>,
) => fields.some((field) => field.required && !sampleValue(values, defaults, field.name).trim());

/**
 * 시험 값으로 실행 입력과 공통 정보를 만든다. 빈 칸은 보내지 않는다. 필드 자리 기능은 첫 컬렉션으로, 번역 자리 기능은
 * 대상 언어(`to`, 번역 자리가 주는 입력)로 실행한다.
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

/** 시험 칸들. 칸 이름(aria-label·placeholder)은 입력 이름표다. */
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
