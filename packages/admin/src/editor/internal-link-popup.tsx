"use client";

import { COLLECTION_DEFINITIONS, createTranslator, isCollection } from "@monti-cms/core/client";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "../lib/utils/cn";
import { CollectionIcon } from "../screens/shared/collection-icon";
import { Spinner } from "../ui/spinner";
import { type InternalLinkItem, internalLinkHref } from "./internal-link";
import { editorMessages } from "./messages";

const t = createTranslator(editorMessages);

interface InternalLinkPopupProps {
	items: InternalLinkItem[];
	isLoading: boolean;
	coords: { top: number; left: number };
	selectedIndex: number;
	onSelect: (item: InternalLinkItem) => void;
	onClose: () => void;
}

/** 글 아래 줄: 컬렉션 이름 · 주소 · 초안 여부. */
function itemMeta(item: InternalLinkItem): string {
	const collection = isCollection(item.collection) ? COLLECTION_DEFINITIONS[item.collection].label : item.collection;
	// 초안 대상 링크는 편집 중 허용하되 표시한다. 발행하려면 대상이 공개되어야 한다(§6.2).
	const status =
		item.status && item.status !== "published"
			? item.status === "draft"
				? t("internalLink.draft")
				: item.status
			: null;
	// 링크가 실제로 가리킬 공개 경로(컬렉션 `path`)를 보인다.
	return [collection, internalLinkHref(item), status].filter(Boolean).join(" · ");
}

/**
 * `[[` 내부 글 링크 검색 결과(§6.2). 슬래시 메뉴와 같은 모양이다.
 * 포커스와 방향키는 에디터가 맡고 여기서는 강조할 항목(`selectedIndex`)만 그리고 보이게 스크롤한다.
 */
export function InternalLinkPopup({
	items,
	isLoading,
	coords,
	selectedIndex,
	onSelect,
	onClose,
}: InternalLinkPopupProps) {
	const [mounted, setMounted] = useState(false);
	const listRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		setMounted(true);
	}, []);

	useEffect(() => {
		listRef.current
			?.querySelector<HTMLElement>(`[data-index="${selectedIndex}"]`)
			?.scrollIntoView({ block: "nearest" });
	}, [selectedIndex]);

	if (!mounted) return null;

	return createPortal(
		<div
			ref={listRef}
			role="listbox"
			aria-label={t("internalLink.label")}
			aria-busy={isLoading}
			tabIndex={-1}
			style={{ position: "fixed", top: `${coords.top + 24}px`, left: `${coords.left}px`, zIndex: 9999 }}
			onKeyDown={(event) => {
				if (event.key === "Escape") {
					event.preventDefault();
					onClose();
				}
			}}
			className="max-h-80 w-72 overflow-y-auto rounded-lg border bg-cms-popover p-1 text-cms-popover-foreground shadow-lg"
		>
			{items.map((item, index) => (
				<div
					key={item.id}
					role="option"
					aria-selected={index === selectedIndex}
					data-index={index}
					tabIndex={-1}
					onMouseDown={(event) => event.preventDefault()}
					onClick={() => onSelect(item)}
					onKeyDown={(event) => {
						if (event.key === "Enter") onSelect(item);
					}}
					className={cn(
						"flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 outline-none",
						index === selectedIndex ? "bg-cms-accent text-cms-accent-foreground" : "hover:bg-cms-accent/50",
					)}
				>
					<span
						aria-hidden
						className="flex size-8 shrink-0 items-center justify-center rounded-md border bg-cms-background text-cms-muted-foreground [&_svg]:size-4"
					>
						<CollectionIcon collection={item.collection} />
					</span>
					<span className="min-w-0">
						<span className="block truncate font-medium text-sm">{item.title}</span>
						<span className="block truncate text-cms-muted-foreground text-xs">{itemMeta(item)}</span>
					</span>
				</div>
			))}
			{isLoading ? (
				<output className="flex items-center gap-2 px-2 py-1.5 text-cms-muted-foreground text-xs">
					<Spinner className="size-3.5" />
					{t("internalLink.searching")}
				</output>
			) : (
				items.length === 0 && <p className="px-2 py-1.5 text-cms-muted-foreground text-xs">{t("internalLink.empty")}</p>
			)}
		</div>,
		document.body,
	);
}
