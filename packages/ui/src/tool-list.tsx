import type * as React from "react";
import { cn } from "./cn";
import { MENU_CARD, MENU_LABEL, MENU_ROW } from "./menu-parts";
import { HELD } from "./sortable";

/**
 * 설정 › 관리자 › 편집기 도구의 항목 목록(2026-11 개편 시안 `settings-toolbar*.html`): 서식 막대나 / 블록 메뉴에 무엇이 어떤 순서로 보이는지.
 * `border-default` 테두리의 `radius-lg` 상자, 종이 바탕, 안의 버튼은 6px 모서리. 머리 {@link ToolListHead}, 항목 {@link ToolListItem},
 * 구분선 {@link ToolListSeparator}, 맨 아래 {@link ToolListAdd}.
 */
function ToolList({ className, ...props }: React.ComponentProps<"ul">) {
	return (
		<ul
			data-slot="tool-list"
			data-shape="square"
			className={cn(
				"m-0 flex list-none flex-col overflow-hidden rounded-monti-lg border border-monti-default bg-monti-page p-0",
				className,
			)}
			{...props}
		/>
	);
}

/** 묶음의 머리("보이는 항목 · 8"): 32px, 도구 바탕, 12px 500 흐림, 양끝 12px 안. `aside`는 끝에 붙는 풀이(400). */
function ToolListHead({ aside, children }: { aside?: React.ReactNode; children: React.ReactNode }) {
	return (
		<li
			data-slot="tool-list-head"
			className="flex h-monti-control-md shrink-0 items-center gap-monti-12 border-monti-muted border-b bg-monti-tool px-monti-12 font-medium text-monti-caption text-monti-faint"
		>
			<span>{children}</span>
			{aside && <span className="ml-auto font-normal">{aside}</span>}
		</li>
	);
}

const ITEM =
	"grid h-monti-control-lg grid-cols-[16px_16px_minmax(0,1fr)_auto_24px] items-center gap-[10px] px-monti-12 text-monti-body";

/**
 * 항목 한 줄: 36px, 양끝 12px 안. 손잡이(`handle`), 아이콘(16px `fg-subtle`), 이름, 단축키(`shortcut`, 12px 흐림), 끝에 보이기 · 숨기기 버튼
 * (`action`, 24px). `hidden`: 숨긴 항목이라 이름이 흐리고 아이콘이 더 흐리다. `held`: 끌고 있는 항목이다. 놓일 자리는 올림 바탕에 먹색 2px 선으로
 * 남고, 항목은 그 위 상자 안에 떠서(`HELD`, 양옆 4px 안, 8px 아래) 손을 따라 조금 기운다. 상자 밖으로 나가 잘리지 않는다.
 */
function ToolListItem({
	handle,
	icon,
	name,
	shortcut,
	action,
	hidden = false,
	held = false,
	className,
	...props
}: Omit<React.ComponentProps<"li">, "children"> & {
	handle?: React.ReactNode;
	icon: React.ReactNode;
	name: React.ReactNode;
	shortcut?: React.ReactNode;
	action?: React.ReactNode;
	hidden?: boolean;
	held?: boolean;
}) {
	const row = (
		<>
			<span className="flex items-center justify-center">{handle}</span>
			<span className={cn("flex items-center [&_svg]:size-4", hidden ? "text-monti-disabled" : "text-monti-subtle")}>
				{icon}
			</span>
			<span className="min-w-0">{name}</span>
			<span className="text-monti-caption text-monti-faint">{shortcut}</span>
			<span className="flex items-center justify-center">{action}</span>
		</>
	);
	return (
		<li
			data-slot="tool-list-item"
			data-hidden={hidden || undefined}
			className={cn(
				"relative shrink-0 border-monti-muted border-b",
				held
					? "h-monti-control-lg bg-monti-muted before:absolute before:inset-x-monti-4 before:-top-px before:h-[2px] before:rounded-[1px] before:bg-(--monti-border-contrast)"
					: cn(ITEM, hidden ? "text-monti-faint" : "text-monti-default"),
				className,
			)}
			{...props}
		>
			{held ? (
				<div
					data-slot="tool-list-held"
					className={cn(
						ITEM,
						HELD,
						"absolute inset-x-monti-4 top-0 translate-y-monti-8 -rotate-[0.6deg] rounded-monti-md px-monti-8 text-monti-default",
					)}
				>
					{row}
				</div>
			) : (
				row
			)}
		</li>
	);
}

/** 구분선 한 줄: 24px, 도구 바탕, 손잡이와 선, 끝에 빼기 버튼(`action`). */
function ToolListSeparator({
	handle,
	action,
	className,
	...props
}: Omit<React.ComponentProps<"li">, "children"> & { handle?: React.ReactNode; action?: React.ReactNode }) {
	return (
		<li
			data-slot="tool-list-separator"
			className={cn(
				"grid h-monti-control-xs shrink-0 grid-cols-[16px_minmax(0,1fr)_24px] items-center gap-[10px] border-monti-muted border-b bg-monti-tool px-monti-12",
				className,
			)}
			{...props}
		>
			<span className="flex items-center justify-center">{handle}</span>
			<span aria-hidden className="mr-monti-4 h-px bg-(--monti-border-default)" />
			<span className="flex items-center justify-center">{action}</span>
		</li>
	);
}

/** 맨 아래 "+ 구분선 넣기": 줄 전체가 버튼(36px, 가리키면 `bg-muted`). + 는 손잡이 열에, 글자는 항목 아이콘의 열에 선다. */
function ToolListAdd({ className, children, ...props }: React.ComponentProps<"button">) {
	return (
		<li className="flex">
			<button
				type="button"
				data-slot="tool-list-add"
				className={cn(
					"grid h-monti-control-lg w-full cursor-pointer grid-cols-[16px_minmax(0,1fr)] items-center gap-[10px] border-0 bg-transparent px-monti-12 text-left text-monti-body text-monti-subtle outline-none transition-colors hover:bg-monti-muted hover:text-monti-default focus-visible:ring-2 focus-visible:ring-monti-contrast/60 focus-visible:ring-inset [&_svg]:size-4",
					className,
				)}
				{...props}
			>
				{children}
			</button>
		</li>
	);
}

/**
 * 편집기 도구의 미리보기: 목록 옆의 도구 바탕 상자(`radius-lg`, 안쪽 14px, 화면을 내려도 위에 붙는다). 머리 줄(12px 500 흐림, 끝에 `note`) 아래
 * 종이 바탕의 무대(`radius-md`, `border-muted`)가 있고, 그 위 왼쪽 16px에 `float`(서식 막대나 / 메뉴)가 뜬다. `stage="bar"`: 150px 무대에 막대가 위
 * 22px에 뜨고 글은 78px 아래에서 시작한다(15/26). `stage="menu"`: 340px 무대, 글은 16px 안, 메뉴는 위 44px.
 */
function ToolPreview({
	title,
	note,
	stage = "bar",
	float,
	children,
}: {
	title: React.ReactNode;
	note?: React.ReactNode;
	stage?: "bar" | "menu";
	float: React.ReactNode;
	children: React.ReactNode;
}) {
	return (
		<section
			data-slot="tool-preview"
			className="sticky top-0 rounded-monti-lg border border-monti-default bg-monti-tool p-[14px]"
		>
			<div className="mb-monti-12 flex items-center font-medium text-monti-caption text-monti-faint">
				<span>{title}</span>
				{note && <span className="ml-auto">{note}</span>}
			</div>
			<div
				aria-hidden
				className={cn(
					"relative overflow-hidden rounded-monti-md border border-monti-muted bg-monti-page text-[15px] text-monti-muted leading-[26px]",
					stage === "bar" ? "h-[150px] px-monti-16 pt-[78px]" : "h-[340px] p-monti-16",
				)}
			>
				{children}
				<div className={cn("absolute left-monti-16", stage === "bar" ? "top-[22px]" : "top-[44px]")}>{float}</div>
			</div>
		</section>
	);
}

/** 미리보기 글에서 고른 낱말: 고른 바탕에 먹색. */
function ToolPreviewSelection(props: { children: React.ReactNode }) {
	return <span className="bg-monti-selected text-monti-default">{props.children}</span>;
}

/**
 * 미리보기의 / 메뉴: 메뉴 카드(236px)를 그대로 그린 그림이다(누르지 않는다). `label` 묶음 이름, 항목은 {@link ToolPreviewMenuItem},
 * `more`는 다 싣지 못한 수("외 6개", 24px 12px 흐림).
 */
function ToolPreviewMenu({
	label,
	more,
	children,
}: {
	label: React.ReactNode;
	more?: React.ReactNode;
	children: React.ReactNode;
}) {
	return (
		<div data-slot="tool-preview-menu" className={cn(MENU_CARD, "w-[236px] p-monti-4")}>
			<div className={MENU_LABEL}>{label}</div>
			{children}
			{more && (
				<div className="flex h-monti-control-xs items-center px-monti-8 text-monti-caption text-monti-faint">
					<span>{more}</span>
				</div>
			)}
		</div>
	);
}

/** / 메뉴 그림의 한 줄: 메뉴 행과 같다. `current`: 키보드가 선 줄(`bg-muted`, 먹색). */
function ToolPreviewMenuItem({ current = false, children }: { current?: boolean; children: React.ReactNode }) {
	return <div className={cn(MENU_ROW, current && "bg-monti-muted text-monti-default")}>{children}</div>;
}

export {
	ToolList,
	ToolListAdd,
	ToolListHead,
	ToolListItem,
	ToolListSeparator,
	ToolPreview,
	ToolPreviewMenu,
	ToolPreviewMenuItem,
	ToolPreviewSelection,
};
