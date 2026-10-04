"use client";

import type { FieldInputParts, FieldInputProps } from "@monti-cms/admin";
import { cn, Switch } from "@monti-cms/admin/kit";
import { isCollection, roleValue, SUMMARY_ROLE } from "@monti-cms/core/client";
import { SEO_DEFAULT_LIMITS } from "../fields";

/** 권장 글자 수: 필드 `max` → `inputOptions.limit` → 기본값. */
const limitOf = (field: FieldInputProps["field"], fallback: number) => {
	if ("max" in field && typeof field.max === "number") return field.max;
	const limit = field.inputOptions?.limit;
	return typeof limit === "number" ? limit : fallback;
};

const current = (props: FieldInputProps) => (typeof props.value === "string" ? props.value : "");

/** 글자 수. 권장 글자 수를 넘으면 색을 바꾼다. 비었으면 대신 쓸 값의 글자 수다. */
function Counter({ length, limit }: { length: number; limit: number }) {
	return (
		<span
			className={cn(
				"text-[11px] text-cms-muted-foreground tabular-nums",
				length > limit && "cms-dark:text-amber-400 text-amber-600",
			)}
		>
			{length}/{limit}
		</span>
	);
}

/** 비었을 때 공개 화면이 대신 쓰는 값으로 안내 문구와 글자 수를 보이는 입력 조각. */
const withFallback = (fallback: (props: FieldInputProps) => string, defaultLimit: number): FieldInputParts => ({
	placeholder: (props) => fallback(props) || undefined,
	Aside: (props) => (
		<Counter length={(current(props) || fallback(props)).length} limit={limitOf(props.field, defaultLimit)} />
	),
});

/** 검색 제목: 비우면 제목을 쓴다. */
export const seoTitleInput = withFallback((props) => props.form.title, SEO_DEFAULT_LIMITS.title);

/** 검색 설명: 비우면 요약 역할 값을 쓴다. */
export const seoDescriptionInput = withFallback(
	(props) => (isCollection(props.collection) ? roleValue(props.collection, SUMMARY_ROLE, props.form) : ""),
	SEO_DEFAULT_LIMITS.description,
);

/** 검색엔진에 숨기기: 이름표 줄의 스위치. 켜면 `noindex`, 끄면 기본값(또는 다른 선택지)이다. */
function NoindexSwitch({ field, id, value, describedBy, context, onChange }: FieldInputProps) {
	if (field.kind !== "select") return null;
	const off =
		field.defaultValue !== "noindex"
			? field.defaultValue
			: (Object.keys(field.options).find((option) => option !== "noindex") ?? field.defaultValue);
	const selected = typeof value === "string" ? value : field.defaultValue;
	return (
		<Switch
			id={id}
			size="sm"
			checked={selected === "noindex"}
			disabled={context.disabled}
			aria-describedby={describedBy}
			onCheckedChange={(checked) => onChange(checked ? "noindex" : off)}
		/>
	);
}

export const seoNoindexInput: FieldInputParts = { Input: null, Aside: NoindexSwitch };
