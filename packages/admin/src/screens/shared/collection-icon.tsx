"use client";

import { isCollection, isItemCollection, schemaOf } from "@monti-cms/core/client";
import {
	Bookmark,
	BookOpen,
	Box,
	Calendar,
	CircleX,
	FileText,
	Folder,
	Highlighter,
	Image,
	Layers,
	Link,
	List,
	type LucideIcon,
	MessageSquare,
	Minus,
	Newspaper,
	NotebookPen,
	Plug,
	Plus,
	Puzzle,
	Settings,
	Shapes,
	Sigma,
	Star,
	Tag,
	TriangleAlert,
	User,
	Users,
	Video,
} from "lucide-react";
import { useCallback } from "react";
import { useCmsAdminComponents } from "../../admin-components";

/**
 * 컬렉션 정의의 `icon`·플러그인 사이드바 항목의 `icon`·블록 정의의 `editor.icon`·코드 줄 효과의 `icon`(lucide 이름)으로
 * 고를 수 있는 본체 아이콘. 모든 아이콘을 싣지 않도록 자주 쓰는 것만 둔다. 다른 이름은 플러그인·사이트가
 * `CmsAdminComponentsProvider`의 `icons`로 등록한다. 컬렉션은 없는 이름이면 발행형은 문서, 분류용은 태그 아이콘을 쓴다.
 */
const ICONS: Readonly<Record<string, LucideIcon>> = {
	bookmark: Bookmark,
	"book-open": BookOpen,
	box: Box,
	calendar: Calendar,
	"circle-x": CircleX,
	"file-text": FileText,
	folder: Folder,
	highlighter: Highlighter,
	image: Image,
	layers: Layers,
	link: Link,
	list: List,
	"message-square": MessageSquare,
	minus: Minus,
	newspaper: Newspaper,
	"notebook-pen": NotebookPen,
	plug: Plug,
	plus: Plus,
	puzzle: Puzzle,
	settings: Settings,
	shapes: Shapes,
	sigma: Sigma,
	star: Star,
	tag: Tag,
	"triangle-alert": TriangleAlert,
	user: User,
	users: Users,
	video: Video,
};

export const COLLECTION_ICON_NAMES = Object.keys(ICONS);

/**
 * 이름으로 아이콘을 고르는 함수. 등록한 아이콘(`CmsAdminComponents.icons`)을 먼저 보고, 없으면 본체 아이콘이다.
 * 모르는 이름이면 `undefined`다.
 */
export function useIconByName(): (name: string | undefined) => LucideIcon | undefined {
	const { icons } = useCmsAdminComponents();
	return useCallback((name) => (name ? (icons?.[name] ?? ICONS[name]) : undefined), [icons]);
}

export function CollectionIcon({ collection }: { collection: string }) {
	const iconByName = useIconByName();
	const name = isCollection(collection) ? schemaOf(collection).icon : undefined;
	const Icon = iconByName(name) ?? (isItemCollection(collection) ? Tag : FileText);
	return <Icon />;
}

/** 이름으로 고른 아이콘. 모르는 이름이면 플러그 아이콘이다. */
export function NamedIcon({ name }: { name?: string }) {
	const Icon = useIconByName()(name) ?? Plug;
	return <Icon />;
}
