import { useState } from "react";
import { Document, Folder, Image, List, Pen, SettingsAdjust, Spark, Tag, Tools, TrashCan } from "../../icons";
import {
	Count,
	folderTree,
	IconButton,
	Inline,
	Sidebar,
	SidebarContent,
	SidebarFoot,
	SidebarFooter,
	SidebarGroup,
	SidebarGroupContent,
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
} from "../../index";

/** The sidebar row that is open. */
export type FramePlace =
	| "posts"
	| "memos"
	| "categories"
	| "tags"
	| "series"
	| "media"
	| "trash"
	| "tools"
	| "settings";

const Link = (props: React.ComponentProps<"a">) => <a {...props} />;

function Row({
	place,
	open,
	icon,
	name,
	count,
	tone,
	children,
}: {
	place: FramePlace;
	open: FramePlace | null;
	icon: React.ReactNode;
	name: string;
	count?: string;
	tone?: "warning";
	children?: React.ReactNode;
}) {
	const active = place === open;
	return (
		<SidebarMenuItem>
			<SidebarMenuButton
				isActive={active}
				tooltip={count ? `${name} ${count}` : name}
				render={<Link href={`#${place}`} aria-current={active ? "page" : undefined} />}
			>
				{icon}
				<span>{name}</span>
				{count ? <SidebarMenuBadge tone={tone}>{count}</SidebarMenuBadge> : null}
			</SidebarMenuButton>
			{children}
		</SidebarMenuItem>
	);
}

/**
 * The admin's frame for the reference screens: the sidebar as the app draws it, then the screen. Every reference screen sits in it, so the sidebar is
 * drawn once.
 */
/** A folder under the open row: its name, its count, how deep it sits, whether it is the open one. */
export interface FrameFolder {
	readonly name: string;
	readonly count?: string;
	readonly depth?: 0 | 1 | 2 | 3;
	readonly active?: boolean;
}

export function AdminFrame({
	open = "posts",
	rail: railStart = false,
	modeOpen,
	folders = [],
	counts = {},
	corner = true,
	mode: modeStart = "system",
	fixed = true,
	panel,
	children,
}: {
	/** The open row; `null` when no row is open (a screen reached from elsewhere). */
	open?: FramePlace | null;
	rail?: boolean;
	/** The screen mode menu is open (a folded sidebar's menu). */
	modeOpen?: boolean;
	/** The folders listed under the open row, as the board draws them. */
	folders?: readonly FrameFolder[];
	/** The rows' counts, as the board draws them (posts 148, trash 3, tools 1 by default). */
	counts?: Partial<Record<FramePlace, string>>;
	/** The assistant's ✦ button in the page's top-right corner; off where a panel covers it. */
	corner?: boolean;
	/** A panel docked at the page's right edge (the assistant, the properties), beside the page as the app's frame puts it. */
	panel?: React.ReactNode;
	/** The screen mode picked at first. */
	mode?: "system" | "light" | "dark";
	/** Holds the window as the app does; off to draw two frames side by side (a board comparing sidebars). */
	fixed?: boolean;
	children?: React.ReactNode;
}) {
	const [rail, setRail] = useState(railStart);
	const [mode, setMode] = useState<"system" | "light" | "dark">(modeStart);
	const count = { posts: "148", trash: "3", tools: "1", ...counts };
	const tree = folderTree(folders.map((folder) => folder.depth ?? 0));
	const sub =
		!rail && folders.length > 0 ? (
			<SidebarMenuSub aria-label="폴더">
				{folders.map((folder, index) => (
					<li key={folder.name}>
						<SidebarMenuSubButton
							render={<button type="button" />}
							isActive={folder.active}
							depth={folder.depth}
							tree={tree[index]}
						>
							<span>{folder.name}</span>
							{folder.count ? <Count>{folder.count}</Count> : null}
						</SidebarMenuSubButton>
					</li>
				))}
			</SidebarMenuSub>
		) : null;
	const row = (place: FramePlace, icon: React.ReactNode, name: string, tone?: "warning") => (
		<Row place={place} open={open} icon={icon} name={name} count={count[place]} tone={tone}>
			{place === open ? sub : null}
		</Row>
	);
	return (
		// Text with no role of its own reads at the body size (14px on a 20px line), as the board's page does.
		<Text as="div" variant="body">
			<SidebarProvider fixed={fixed} rail={rail} onRailChange={setRail}>
				<Sidebar label="관리자 메뉴">
					<SidebarHeader>
						<Text variant="title" truncate>
							example.dev
						</Text>
						<SidebarRailToggle />
					</SidebarHeader>
					<SidebarContent>
						<SidebarGroup>
							<SidebarGroupContent>
								<SidebarMenu aria-label="콘텐츠">
									{row("posts", <Document />, "게시글")}
									{row("memos", <Pen />, "메모")}
									{row("categories", <Folder />, "카테고리")}
									{row("tags", <Tag />, "태그")}
									{row("series", <List />, "시리즈")}
									{row("media", <Image />, "미디어")}
								</SidebarMenu>
							</SidebarGroupContent>
						</SidebarGroup>
					</SidebarContent>
					<SidebarFooter>
						<SidebarMenu aria-label="관리">
							{row("trash", <TrashCan />, "휴지통")}
							{row("tools", <Tools />, "도구", "warning")}
							{row("settings", <SettingsAdjust />, "설정")}
						</SidebarMenu>
						<SidebarFoot>
							<SidebarScreenMode
								value={mode}
								onValueChange={setMode}
								defaultOpen={modeOpen}
								labels={{ label: "화면 모드", system: "시스템", light: "밝게", dark: "어둡게" }}
							/>
						</SidebarFoot>
					</SidebarFooter>
				</Sidebar>
				<SidebarInset
					fixed
					corner={
						corner ? (
							<IconButton label="어시스턴트 열기">
								<Spark className="size-monti-icon-lg" />
							</IconButton>
						) : undefined
					}
				>
					{/* As the app's frame: the page is the container its column measures, and a docked panel sits beside it. */}
					<Inline align="stretch" gap={0} grow minHeight={0} overflow="hidden">
						<Stack gap={0} grow minWidth={0} minHeight={0} container overflow="y">
							{children}
						</Stack>
						{panel}
					</Inline>
				</SidebarInset>
			</SidebarProvider>
		</Text>
	);
}
