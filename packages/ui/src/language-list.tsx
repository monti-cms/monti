import type * as React from "react";
import { cn } from "./cn";

/**
 * 설정 › 언어의 콘텐츠 언어 목록(2026-11 개편 시안 `settings-lang.html`): `border-default` 테두리의 `radius-lg` 상자, 종이 바탕. 줄은
 * {@link LanguageListRow}, 맨 아래는 {@link LanguageListAdd}다. 상자는 둥근 그릇이라 그 안의 버튼은 6px 모서리다(`data-shape="square"`, button.md 모양 기준).
 */
function LanguageList({ className, ...props }: React.ComponentProps<"ul">) {
	return (
		<ul
			data-slot="language-list"
			data-shape="square"
			className={cn(
				"m-0 flex list-none flex-col overflow-hidden rounded-monti-lg border border-monti-default bg-monti-page p-0",
				className,
			)}
			{...props}
		/>
	);
}

/**
 * 언어 한 줄: 40px(줄 선 포함), 양끝 12px 안(줄 끝의 버튼이 시작선 · 끝선에 붙지 않는다, button.md 줄 끝의 버튼). 손잡이(`handle`, 16px 열),
 * 그 언어로 쓴 이름(14px 먹색), 코드(mono 12px), 화면 언어로 쓴 이름(`label`, 13px 흐림), 끝에 `children`(번역 수, ⋯ 또는 원문 표시와 "원문 바꾸기").
 * `source`: 원문 줄. 도구 바탕이고, 손잡이 자리는 비워 이름이 다른 줄과 한 선에 선다. 옮길 수 있는 줄은 가리키면 `bg-muted`이고, 줄의 메뉴가 열린 동안에도 그렇다.
 */
function LanguageListRow({
	name,
	code,
	label,
	handle,
	source = false,
	className,
	children,
	...props
}: Omit<React.ComponentProps<"li">, "children"> & {
	name: React.ReactNode;
	code: string;
	label?: React.ReactNode;
	handle?: React.ReactNode;
	source?: boolean;
	children?: React.ReactNode;
}) {
	return (
		<li
			data-slot="language-list-row"
			data-source={source || undefined}
			className={cn(
				"flex h-monti-row shrink-0 items-center gap-[10px] border-monti-muted border-b px-monti-12",
				source ? "bg-monti-tool" : "hover:bg-monti-muted has-[[aria-expanded=true]]:bg-monti-muted",
				className,
			)}
			{...props}
		>
			<span className="flex w-4 shrink-0 items-center justify-center">{handle}</span>
			<span className="flex min-w-0 items-baseline gap-[10px] whitespace-nowrap">
				<span className="min-w-0 truncate text-monti-body text-monti-default">{name}</span>
				<span className="font-mono text-monti-caption text-monti-subtle">{code}</span>
				{label && <span className="text-monti-faint text-monti-label">{label}</span>}
			</span>
			<span className="ml-auto flex shrink-0 items-center gap-monti-6">{children}</span>
		</li>
	);
}

/** 원문 줄 끝의 표시: 20px, `radius-sm`, 고른 바탕에 11px 600 먹색("원문"). */
function LanguageListFlag({ className, ...props }: React.ComponentProps<"span">) {
	return (
		<span
			data-slot="language-list-flag"
			className={cn(
				"inline-flex h-5 items-center rounded-monti-sm bg-monti-selected px-monti-6 font-semibold text-monti-default text-monti-micro",
				className,
			)}
			{...props}
		/>
	);
}

/** 줄 끝의 번역 수("번역 24 / 26"): 13px 흐림. */
function LanguageListNote({ className, ...props }: React.ComponentProps<"span">) {
	return (
		<span data-slot="language-list-note" className={cn("text-monti-faint text-monti-label", className)} {...props} />
	);
}

/**
 * 목록 맨 아래의 "+ 언어 추가": 줄 전체가 버튼이다(40px, 가리키면 `bg-muted`, 포커스 고리는 안쪽). + 아이콘이 이름들의 시작선에 서고 글자는 8px 뒤, 14px `fg-subtle`.
 */
function LanguageListAdd({ className, children, ...props }: React.ComponentProps<"button">) {
	return (
		<li className="flex">
			<button
				type="button"
				data-slot="language-list-add"
				className={cn(
					"flex h-monti-row w-full cursor-pointer items-center gap-monti-8 border-0 bg-transparent pr-monti-12 pl-[38px] text-monti-body text-monti-subtle outline-none transition-colors hover:bg-monti-muted hover:text-monti-default focus-visible:ring-2 focus-visible:ring-monti-contrast/60 focus-visible:ring-inset [&_svg]:size-4 [&_svg]:shrink-0",
					className,
				)}
				{...props}
			>
				{children}
			</button>
		</li>
	);
}

export { LanguageList, LanguageListAdd, LanguageListFlag, LanguageListNote, LanguageListRow };
