import {
	Document,
	Edit,
	Folder,
	Image,
	Launch,
	ListBulleted,
	Screen,
	SettingsAdjust,
	Tag,
	Tools,
	TrashCan,
} from "@carbon/icons-react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import type * as React from "react";
import { ChangeDot } from "./change-dot";
import { Count } from "./count";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuTrigger,
} from "./dropdown-menu";
import { IconButton } from "./icon-button";
import {
	Sidebar,
	SidebarContent,
	SidebarFoot,
	SidebarFooter,
	SidebarGroup,
	SidebarHeader,
	SidebarIconLink,
	SidebarInset,
	SidebarMenu,
	SidebarMenuBadge,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarMenuSub,
	SidebarMenuSubButton,
	SidebarProvider,
	SidebarRailToggle,
	useSidebar,
} from "./sidebar";
import { Heading, Text } from "./text";

function Row({
	icon,
	children,
	count,
	countTone,
	changed,
	railDot,
	...props
}: {
	railDot?: string;
	tooltip?: string;
	icon: React.ReactNode;
	children: React.ReactNode;
	count?: number;
	countTone?: "default" | "warning";
	isActive?: boolean;
	removed?: boolean;
	changed?: boolean;
	className?: string;
	disabled?: boolean;
}) {
	return (
		<SidebarMenuItem>
			<SidebarMenuButton railDot={railDot} {...props}>
				{icon}
				<span>{children}</span>
				{changed && <ChangeDot label="바뀐 곳" />}
				{count !== undefined && <SidebarMenuBadge tone={countTone}>{count}</SidebarMenuBadge>}
			</SidebarMenuButton>
		</SidebarMenuItem>
	);
}

/** The screen mode at the foot: one icon button that shows the current mode and opens the three modes upward, a ✓ on the current one. */
function ScreenMode({ open }: { open?: boolean }) {
	return (
		<DropdownMenu defaultOpen={open}>
			<IconButton label="화면 모드" side="right" trigger={(button) => <DropdownMenuTrigger render={button} />}>
				<Screen aria-hidden />
			</IconButton>
			<DropdownMenuContent side="top" align="start">
				<DropdownMenuRadioGroup value="system">
					<DropdownMenuRadioItem value="system">시스템</DropdownMenuRadioItem>
					<DropdownMenuRadioItem value="light">라이트</DropdownMenuRadioItem>
					<DropdownMenuRadioItem value="dark">다크</DropdownMenuRadioItem>
				</DropdownMenuRadioGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

type Open = "posts" | "folder" | "media" | "trash" | "tools" | "settings";

/** The rail the admin draws: the site's name, the content rows (the open one has its folders under it), and at the bottom, under a line, the trash, tools and settings. */
function AdminSidebar({ active = "posts", themeOpen = false }: { active?: Open; themeOpen?: boolean }) {
	const { rail } = useSidebar();
	return (
		<Sidebar label="관리 메뉴">
			<SidebarHeader>
				{!rail && (
					<>
						<Text variant="title" className="grow truncate">
							example.dev
						</Text>
						<SidebarIconLink href="#top" label="사이트 열기">
							<Launch aria-hidden />
						</SidebarIconLink>
					</>
				)}
				<SidebarRailToggle />
			</SidebarHeader>
			<SidebarContent>
				<SidebarGroup>
					<SidebarMenu aria-label="콘텐츠">
						<Row icon={<Document aria-hidden />} count={148} isActive={active === "posts"}>
							게시글
						</Row>
						{(active === "posts" || active === "folder") && (
							<li>
								<SidebarMenuSub aria-label="게시글 폴더">
									<li>
										<SidebarMenuSubButton href="#series" isActive={active === "folder"}>
											시리즈 원고
											<Count>2</Count>
										</SidebarMenuSubButton>
									</li>
								</SidebarMenuSub>
							</li>
						)}
						<Row icon={<Edit aria-hidden />}>메모</Row>
						<Row icon={<Folder aria-hidden />}>카테고리</Row>
						<Row icon={<Tag aria-hidden />}>태그</Row>
						<Row icon={<ListBulleted aria-hidden />}>시리즈</Row>
						<Row icon={<Image aria-hidden />} isActive={active === "media"}>
							미디어
						</Row>
						{active === "media" && (
							<li>
								<SidebarMenuSub aria-label="미디어 폴더">
									<li>
										<SidebarMenuSubButton href="#blog" isActive>
											Blog Assets
											<Count>14</Count>
										</SidebarMenuSubButton>
									</li>
									<li>
										<SidebarMenuSubButton href="#covers" depth={1}>
											covers
											<Count>6</Count>
										</SidebarMenuSubButton>
									</li>
									<li>
										<SidebarMenuSubButton href="#diagrams" depth={1}>
											diagrams
											<Count>3</Count>
										</SidebarMenuSubButton>
									</li>
									<li>
										<SidebarMenuSubButton href="#wallpapers">
											Wallpapers
											<Count>7</Count>
										</SidebarMenuSubButton>
									</li>
								</SidebarMenuSub>
							</li>
						)}
					</SidebarMenu>
				</SidebarGroup>
			</SidebarContent>
			<SidebarFooter>
				<SidebarMenu aria-label="아래 묶음">
					<Row icon={<TrashCan aria-hidden />} count={3} isActive={active === "trash"}>
						휴지통
					</Row>
					<Row
						icon={<Tools aria-hidden />}
						count={1}
						countTone="warning"
						tooltip="도구 1"
						railDot="전송 실패 1건"
						isActive={active === "tools"}
					>
						도구
					</Row>
					<Row icon={<SettingsAdjust aria-hidden />} isActive={active === "settings"}>
						설정
					</Row>
				</SidebarMenu>
				<SidebarFoot>
					<ScreenMode open={themeOpen} />
				</SidebarFoot>
			</SidebarFooter>
		</Sidebar>
	);
}

/**
 * The left navigation: the tool ground, a line down its right edge, 232px. The open row is on the selected ground and semibold; pointing at
 * another row gives it a paler ground. Counts sit at the end in mono, and the count that needs attention (failed deliveries on the tools row) in
 * the warning tone. Under the open row its folders show, with the folders on the open path. Drag the edge to change the width.
 */
const meta = {
	title: "Patterns/Frame/Sidebar",
	component: Sidebar,
	args: { label: "관리 메뉴" },
	parameters: { bleed: true },
	render: () => (
		<SidebarProvider>
			<AdminSidebar />
			<SidebarInset className="gap-monti-16 p-monti-32">
				<Heading variant="page">게시글</Heading>
			</SidebarInset>
		</SidebarProvider>
	),
} satisfies Meta<typeof Sidebar>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

/** The media row open, with its folders and the folder inside one (indented 14px a level). */
export const Media: Story = {
	render: () => (
		<SidebarProvider>
			<AdminSidebar active="media" />
			<SidebarInset className="gap-monti-16 p-monti-32">
				<Heading variant="page">Blog Assets</Heading>
			</SidebarInset>
		</SidebarProvider>
	),
};

/** A folder of the posts open, and the rows of the bottom group open. */
export const OtherRows: Story = {
	render: () => (
		<SidebarProvider className="min-h-96">
			<AdminSidebar active="folder" />
			<AdminSidebar active="trash" />
			<AdminSidebar active="tools" />
			<AdminSidebar active="settings" />
		</SidebarProvider>
	),
};

/** The open row, a plain row, a row someone is pointing at (paler than the open one), a row with an unsaved change, a removed row, a disabled row. */
export const RowStates: Story = {
	render: () => (
		<SidebarProvider className="min-h-96">
			<Sidebar label="상태">
				<SidebarContent>
					<SidebarMenu aria-label="상태">
						<Row icon={<Document aria-hidden />} count={148} isActive>
							열린 줄
						</Row>
						<Row icon={<Folder aria-hidden />}>보통 줄</Row>
						<Row icon={<Tag aria-hidden />} className="bg-monti-muted">
							가리킨 줄
						</Row>
						<Row icon={<Image aria-hidden />} changed>
							바뀐 곳이 있는 줄
						</Row>
						<Row icon={<SettingsAdjust aria-hidden />} removed count={2}>
							지운 줄
						</Row>
						<Row icon={<TrashCan aria-hidden />} disabled>
							쓸 수 없는 줄
						</Row>
					</SidebarMenu>
				</SidebarContent>
			</Sidebar>
		</SidebarProvider>
	),
};

/** A name longer than the rail is cut before the count. */
export const LongLabel: Story = {
	render: () => (
		<SidebarProvider className="min-h-96">
			<Sidebar label="콘텐츠">
				<SidebarContent>
					<SidebarMenu aria-label="콘텐츠">
						<Row icon={<Document aria-hidden />} count={128} isActive>
							아주 긴 이름의 콘텐츠 종류가 사이드바 폭을 넘으면 잘려요
						</Row>
					</SidebarMenu>
				</SidebarContent>
			</Sidebar>
		</SidebarProvider>
	),
};

/** Entries dragged over a folder: it gets a ring. */
export const DropTarget: Story = {
	render: () => (
		<SidebarProvider className="min-h-96">
			<Sidebar label="관리 메뉴">
				<SidebarContent>
					<SidebarMenu aria-label="콘텐츠">
						<Row icon={<Document aria-hidden />} isActive>
							게시글
						</Row>
						<li>
							<SidebarMenuSub aria-label="게시글 폴더">
								<li>
									<SidebarMenuSubButton href="#a" dropTarget>
										시리즈 원고
										<Count>2</Count>
									</SidebarMenuSubButton>
								</li>
								<li>
									<SidebarMenuSubButton href="#b">보관</SidebarMenuSubButton>
								</li>
							</SidebarMenuSub>
						</li>
					</SidebarMenu>
				</SidebarContent>
			</Sidebar>
		</SidebarProvider>
	),
};

/** Folded to the icon rail (⌘B or the button in the head row): 64px, the icons where they were, names and counts gone, the tools icon with its dot, the unfold button alone in the head. */
export const Rail: Story = {
	render: () => (
		<SidebarProvider rail>
			<AdminSidebar active="tools" />
			<SidebarInset className="gap-monti-16 p-monti-32">
				<Heading variant="page">도구</Heading>
			</SidebarInset>
		</SidebarProvider>
	),
};

/** The screen mode menu open: system, light and dark, a ✓ on the current one. The default is the system. */
export const ScreenModeMenu: Story = {
	render: () => (
		<SidebarProvider>
			<AdminSidebar themeOpen />
			<SidebarInset className="gap-monti-16 p-monti-32">
				<Heading variant="page">게시글</Heading>
			</SidebarInset>
		</SidebarProvider>
	),
};
