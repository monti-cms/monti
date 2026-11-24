import { Document, Image, Layers, RecentlyViewed, SettingsAdjust, Spark, Tag, Tools, TrashCan, User } from "../icons";
import {
	AssistantSlot,
	Count,
	IconButton,
	Inline,
	Sidebar,
	SidebarContent,
	SidebarFoot,
	SidebarFooter,
	SidebarHeader,
	SidebarInset,
	SidebarMenu,
	SidebarMenuBadge,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarMenuSub,
	SidebarMenuSubButton,
	SidebarProvider,
	SidebarRailToggle,
	SidebarScreenMode,
	Stack,
	Text,
} from "../index";

/** 열린 사이드바 행. */
export type ScreenPlace =
	| "posts"
	| "tags"
	| "people"
	| "series"
	| "media"
	| "trash"
	| "activity"
	| "tools"
	| "settings";

/** 열린 행 아래의 폴더 하나: 이름, 개수, 깊이, 열린 것인지. */
export interface ScreenFolder {
	readonly name: string;
	readonly count?: string;
	readonly depth?: 0 | 1;
	readonly active?: boolean;
}

/** 시안의 글 폴더(`parts/sub-list.html`). */
export const POST_FOLDERS: readonly ScreenFolder[] = [
	{ name: "안내", count: "4" },
	{ name: "국내", count: "1", depth: 1 },
	{ name: "리뷰 폴더 2", count: "1", depth: 1 },
	{ name: "소식", count: "2" },
	{ name: "보기 모음", count: "10" },
];

/** 시안의 미디어 폴더(`parts/sub-media.html`). */
export const MEDIA_FOLDERS: readonly ScreenFolder[] = [
	{ name: "표지", count: "4" },
	{ name: "인물", count: "1" },
	{ name: "문서", count: "2" },
];

const Link = (props: React.ComponentProps<"a">) => <a {...props} />;

function Row({
	place,
	open,
	icon,
	name,
	count,
	tone,
	countLabel,
	folders,
}: {
	place: ScreenPlace;
	open: ScreenPlace | null;
	icon: React.ReactNode;
	name: string;
	count?: string;
	tone?: "warning";
	/** The word before the count ("실패"). */
	countLabel?: string;
	folders?: readonly ScreenFolder[];
}) {
	const active = place === open && !folders?.some((folder) => folder.active);
	return (
		<SidebarMenuItem>
			<SidebarMenuButton
				isActive={active}
				render={<Link href={`#${place}`} aria-current={active ? "page" : undefined} />}
			>
				{icon}
				<span>{name}</span>
				{count ? (
					<SidebarMenuBadge tone={tone} label={countLabel}>
						{count}
					</SidebarMenuBadge>
				) : null}
			</SidebarMenuButton>
			{folders && folders.length > 0 && (
				<SidebarMenuSub aria-label="폴더">
					{folders.map((folder) => (
						<li key={folder.name}>
							<SidebarMenuSubButton render={<button type="button" />} isActive={folder.active} depth={folder.depth}>
								<span>{folder.name}</span>
								{folder.count ? <Count>{folder.count}</Count> : null}
							</SidebarMenuSubButton>
						</li>
					))}
				</SidebarMenuSub>
			)}
		</SidebarMenuItem>
	);
}

/**
 * 기준 화면의 틀: 시안(v5 `parts/sidebar.html`)대로 그린 사이드바와 그 옆의 페이지. 머리 줄 끝의 ✦는 `AssistantSlot`이 페이지 머리에 준다.
 * 관리자 앱이 아니라 승인된 시안을 `@monti-cms/ui` 부품만으로 다시 그린 것이다.
 */
export function ScreenFrame({
	open = "posts",
	folders,
	counts,
	panel,
	children,
}: {
	open?: ScreenPlace | null;
	/** 열린 행 아래에 펼친 폴더. */
	folders?: readonly ScreenFolder[];
	/** 행의 개수를 시안 값 대신(빈 목록의 글 행처럼, `null`이면 개수 없음). */
	counts?: Partial<Record<ScreenPlace, string | null>>;
	/** 페이지 오른쪽에 붙은 패널. */
	panel?: React.ReactNode;
	children?: React.ReactNode;
}) {
	const row = (
		place: ScreenPlace,
		icon: React.ReactNode,
		name: string,
		count?: string,
		tone?: "warning",
		countLabel?: string,
	) => (
		<Row
			place={place}
			open={open}
			icon={icon}
			name={name}
			count={count}
			tone={tone}
			countLabel={countLabel}
			folders={place === open ? folders : undefined}
		/>
	);
	return (
		<Text as="div" variant="body">
			<SidebarProvider fixed>
				<Sidebar label="관리자 메뉴">
					<SidebarHeader>
						<span>Monti 쇼케이스</span>
						<SidebarRailToggle />
					</SidebarHeader>
					<SidebarContent>
						<SidebarMenu aria-label="콘텐츠">
							{row("posts", <Document />, "글", counts?.posts === null ? undefined : (counts?.posts ?? "26"))}
							{row("tags", <Tag />, "태그", "8")}
							{row("people", <User />, "사람", "2")}
							{row("series", <Layers />, "연재", "2")}
							{row("media", <Image />, "미디어")}
						</SidebarMenu>
					</SidebarContent>
					<SidebarFooter>
						<SidebarMenu aria-label="관리">
							{row("trash", <TrashCan />, "휴지통", "2")}
							{/* 실패한 전송은 그것을 보이는 기록에서 센다(시안의 호박색, 2026-11-24 소유자, sidebar.md). */}
							{row("activity", <RecentlyViewed />, "활동 기록", "25", "warning", "실패")}
							{row("tools", <Tools />, "도구")}
							{row("settings", <SettingsAdjust />, "설정")}
						</SidebarMenu>
						<SidebarFoot>
							<SidebarScreenMode
								value="system"
								labels={{ label: "화면 모드", system: "시스템", light: "밝게", dark: "어둡게" }}
							/>
						</SidebarFoot>
					</SidebarFooter>
				</Sidebar>
				<SidebarInset fixed>
					<AssistantSlot
						button={
							<IconButton label="어시스턴트 열기" side="bottom">
								<Spark aria-hidden />
							</IconButton>
						}
					>
						<Inline align="stretch" gap={0} grow minHeight={0} overflow="hidden">
							<Stack gap={0} grow minWidth={0} minHeight={0} container overflow="y">
								{children}
							</Stack>
							{panel}
						</Inline>
					</AssistantSlot>
				</SidebarInset>
			</SidebarProvider>
		</Text>
	);
}

/** 숫자만 mono로: 섞인 말에서 수는 mono, 한국어는 산세리프(소유자 결정). */
export function Num({ children }: { children: React.ReactNode }) {
	return <Text mono>{children}</Text>;
}
