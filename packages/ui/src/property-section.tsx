"use client";

import type * as React from "react";
import { ChangeDot } from "./change-dot";
import { cn } from "./cn";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "./collapsible";
import { CutWords } from "./cut-words";
import { FIELD_ACTION_PANEL, FIELD_INSET } from "./hover";
import { IconButtonContext } from "./icon-button";
import { Add, ChevronDown, ChevronRight, Document, Image as ImageIcon } from "./icons";

/**
 * 속성 패널(2026-11 개편 시안 v5 `panel.html`)의 절: 44px 머리(13px 600 제목, 고칠 것이 있으면 주황 점, 끝에 갈매기)와 그 아래 줄들. 접으면 머리만
 * 남고, 머리 끝에 안의 값을 줄인 `summary`(12px 흐린 글, 길면 "…")가 갈매기 앞에 선다. 열린 절은 마지막 줄 아래 20px를 두고, 절마다 아래에 선이 있다.
 * 양옆은 패널의 24px이고, 머리 전체가 누르는 자리다(모양 없는 줄).
 */
function PropertySection({
	title,
	need = false,
	needLabel,
	summary,
	defaultOpen = true,
	children,
}: {
	title: React.ReactNode;
	/** 이 절에 발행 전에 고칠 것이 있다(주황 점). */
	need?: boolean;
	/** 주황 점의 이름(화면 읽기 프로그램). */
	needLabel?: string;
	/** 접혔을 때 머리 끝에 서는 요약. */
	summary?: React.ReactNode;
	defaultOpen?: boolean;
	children?: React.ReactNode;
}) {
	return (
		<Collapsible
			defaultOpen={defaultOpen}
			data-slot="property-section"
			className="group/section border-monti-default border-b px-monti-24"
		>
			<CollapsibleTrigger
				data-slot="property-section-head"
				className="flex h-11 w-full cursor-pointer items-center gap-monti-6 border-0 bg-transparent p-0 text-left font-semibold text-monti-default text-monti-note outline-none focus-visible:ring-2 focus-visible:ring-monti-contrast/60 focus-visible:ring-inset"
			>
				<span className="shrink-0">{title}</span>
				{need && <ChangeDot label={needLabel} />}
				<span className="min-w-0 flex-1 text-right font-normal text-monti-caption text-monti-faint">
					{summary && <CutWords className="block truncate">{summary}</CutWords>}
				</span>
				{/* 갈매기의 16px 상자가 끝선에서 끝난다. 보이는 끝을 맞추려 밖으로 내밀지 않는다(2026-11-24 소유자). */}
				<span aria-hidden className="flex shrink-0 text-monti-faint [&>svg]:size-4">
					<ChevronDown className="hidden group-data-[open]/section:block" />
					<ChevronRight className="group-data-[open]/section:hidden" />
				</span>
			</CollapsibleTrigger>
			<CollapsibleContent className="flex flex-col gap-monti-4 pb-monti-20">{children}</CollapsibleContent>
		</Collapsible>
	);
}

/**
 * 속성 한 줄: 왼쪽 라벨 열(72px, `width-label`)과 8px 뒤의 값. 라벨은 13px 흐린 잉크로 값의 첫 줄(32px)에 맞춰 서고, 길면 줄을 바꾼다("…"로 자르지
 * 않는다). 값 자리에는 입력 부품이 처음부터 있다: 그 칸이 라벨 열 끝 8px 뒤에서 시작하고 글자는 칸 안 8px에서 시작한다.
 */
function PropertyRow({
	label,
	htmlFor,
	children,
}: {
	label: React.ReactNode;
	/** 라벨이 가리키는 입력 부품의 id. */
	htmlFor?: string;
	children: React.ReactNode;
}) {
	return (
		<div
			data-slot="property-row"
			className={cn("grid grid-cols-[var(--monti-width-label)_minmax(0,1fr)] gap-x-monti-8", FIELD_ACTION_PANEL)}
		>
			<label
				htmlFor={htmlFor}
				className="break-keep pt-[5.5px] text-monti-note text-monti-subtle [overflow-wrap:anywhere]"
			>
				{label}
			</label>
			<div className="min-w-0">{children}</div>
		</div>
	);
}

/**
 * 고르는 칸이 아닌 값(글쓴이, 관련 글, 형식, 스위치 줄): 입력 칸의 글자와 같은 자리(칸 안 8px)에서 시작하는 글. 여러 줄이면(`stacked`) 줄 사이 2px로
 * 쌓인다. `end`는 줄 끝의 컨트롤(스위치)로, 값 열의 끝선에 맞닿는다.
 */
function PropertyValue({
	stacked = false,
	end,
	children,
}: {
	stacked?: boolean;
	end?: React.ReactNode;
	children: React.ReactNode;
}) {
	return (
		<div
			data-slot="property-value"
			className={cn(
				// 입력 칸처럼 아래 1px(투명한 밑줄)를 두어 글자가 칸의 글자와 같은 높이에 선다.
				"flex min-h-monti-control-md min-w-0 gap-monti-8 border-transparent border-b py-[5.5px] text-monti-body text-monti-default",
				FIELD_INSET,
				end && "pr-0",
				stacked ? "flex-col gap-monti-2" : "items-center",
			)}
		>
			<div className={cn("flex min-w-0 flex-1 gap-monti-8", stacked ? "flex-col gap-monti-2" : "items-center")}>
				{children}
			</div>
			{end && <span className="flex shrink-0 items-center">{end}</span>}
		</div>
	);
}

/** 값 아래의 한 줄(글자 수, 그림의 크기, 받는 파일): 12px 흐린 글, 값의 글자 자리에서 시작한다. `align="end"`면 끝선에 맞춘다. */
function PropertyNote({
	align = "start",
	tone = "faint",
	children,
}: {
	align?: "start" | "end";
	tone?: "faint" | "danger";
	children: React.ReactNode;
}) {
	return (
		<p
			data-slot="property-note"
			className={cn(
				"m-0 pt-monti-4 pb-monti-2 text-monti-caption",
				FIELD_INSET,
				tone === "danger" ? "text-monti-danger" : "text-monti-faint",
				align === "end" && "pr-0 text-right",
			)}
		>
			{children}
		</p>
	);
}

/**
 * 표지 칸: 16:9 자리. 비었으면 1px 점선 상자(`radius-md`) 가운데에 그림 표시와 "이미지 고르기 · 끌어 놓기"가 있는 버튼이고, 고른 그림이 있으면 그 그림이
 * 상자를 채우고 오른쪽 위 6px 안에 `action`(⋯)이 선다. 값 열 칸의 시작에서 끝선까지 선다.
 */
function PropertyCover({
	src,
	placeholder,
	action,
	onOpen,
}: {
	/** 고른 그림. 없으면 빈 자리. */
	src?: string;
	placeholder: React.ReactNode;
	/** 고른 그림의 메뉴 버튼. */
	action?: React.ReactNode;
	onOpen?: () => void;
}) {
	if (src)
		return (
			<div
				data-slot="property-cover"
				data-shape="square"
				className="relative aspect-video w-full overflow-hidden rounded-monti-md bg-monti-muted"
			>
				<img src={src} alt="" className="size-full object-cover" />
				{action && (
					<span className="absolute top-monti-6 right-monti-6 flex rounded-monti-md bg-monti-page shadow-[0_0_0_1px_var(--monti-border-default)]">
						<IconButtonContext value={{ size: "sm" }}>{action}</IconButtonContext>
					</span>
				)}
			</div>
		);
	return (
		<button
			type="button"
			data-slot="property-cover"
			onClick={onOpen}
			className="flex aspect-video w-full cursor-pointer flex-col items-center justify-center gap-monti-4 rounded-monti-md border border-monti-strong border-dashed bg-monti-muted p-0 text-monti-caption text-monti-faint outline-none transition-colors hover:bg-monti-selected focus-visible:ring-2 focus-visible:ring-monti-contrast/60 [&>svg]:size-4"
		>
			<ImageIcon aria-hidden />
			{placeholder}
		</button>
	);
}

/**
 * 첨부 파일 한 줄(32px): 파일 표시, 이름(길면 "…"), 크기(12px 흐린 잉크), 끝에 `action`(⋯). 이름은 누르는 글이고 포인터가 오면 밑줄이 선다. 칸의 글자
 * 자리에서 시작하고 끝의 버튼은 값 열의 끝선에 맞닿는다.
 */
function PropertyFile({ name, size, action }: { name: string; size: string; action?: React.ReactNode }) {
	return (
		<div
			data-slot="property-file"
			// 입력 칸처럼 아래 1px(투명한 밑줄)를 두어 이름이 라벨과 같은 높이에 선다.
			className={cn(
				"flex h-monti-control-md min-w-0 items-center gap-monti-8 border-transparent border-b text-monti-body",
				FIELD_INSET,
				"pr-0",
			)}
		>
			{/* 파일 표시의 획은 16px 상자 안 3px에서 시작한다: 그만큼 당겨 획이 값의 글자선에 선다. */}
			<Document aria-hidden className="-ml-[3px] size-4 shrink-0 text-monti-faint" />
			<button
				type="button"
				className="min-w-0 cursor-pointer border-0 bg-transparent p-0 text-left text-monti-default underline-offset-3 outline-none hover:underline hover:decoration-(--monti-fg-subtle) focus-visible:underline"
			>
				<CutWords className="block truncate">{name}</CutWords>
			</button>
			<span className="ml-auto shrink-0 text-monti-caption text-monti-faint tabular-nums">{size}</span>
			{action && (
				<span className="flex shrink-0">
					<IconButtonContext value={{ size: "xs" }}>{action}</IconButtonContext>
				</span>
			)}
		</div>
	);
}

/**
 * 첨부 파일의 마지막 줄 "+ 파일 추가"(32px): 누르는 글(`fg-subtle`, 포인터에 잉크와 밑줄). + 의 획이 값의 글자선에서 시작한다(14px 상자 안 3.5px만큼
 * 당긴다). `rest`는 보이지 않는 나머지 파일("외 21개 · 모두 보기")로, 끝선에서 끝난다.
 */
function PropertyFileAdd({ children, rest }: { children: React.ReactNode; rest?: React.ReactNode }) {
	const press =
		"cursor-pointer border-0 bg-transparent p-0 text-monti-subtle underline-offset-4 outline-none hover:text-monti-default hover:underline focus-visible:rounded-monti-sm focus-visible:outline-2 focus-visible:outline-monti-contrast/60 focus-visible:outline-offset-2";
	return (
		<div
			data-slot="property-file-add"
			className={cn(
				"flex h-monti-control-md min-w-0 items-center gap-monti-8 border-transparent border-b text-monti-body",
				FIELD_INSET,
				"pr-0",
			)}
		>
			<button type="button" className={cn(press, "flex shrink-0 items-center gap-monti-6")}>
				<Add aria-hidden className="-ml-[3.5px] size-3.5" />
				{children}
			</button>
			{rest && (
				<button type="button" className={cn(press, "ml-auto min-w-0 truncate text-monti-note")}>
					{rest}
				</button>
			)}
		</div>
	);
}

/**
 * 검색 결과 미리보기: 검색 엔진이 보일 제목, 주소(초록), 설명. 1px 선의 `radius-md` 상자(입력 칸의 바탕), 안 10 · 12px. 값 열이 아니라 절의 폭 전체에 선다.
 */
function SearchPreview({ title, url, description }: { title: string; url: string; description: string }) {
	return (
		<div
			data-slot="search-preview"
			className="mb-monti-8 rounded-monti-md border border-monti-default bg-monti-page px-monti-12 py-monti-10"
		>
			<p className="m-0 truncate font-medium text-monti-body text-monti-default">{title}</p>
			<p className="m-0 mt-px mb-monti-2 truncate text-monti-caption text-monti-success">{url}</p>
			<p className="m-0 line-clamp-2 text-monti-caption text-monti-subtle">{description}</p>
		</div>
	);
}

export {
	PropertyCover,
	PropertyFile,
	PropertyFileAdd,
	PropertyNote,
	PropertyRow,
	PropertySection,
	PropertyValue,
	SearchPreview,
};
