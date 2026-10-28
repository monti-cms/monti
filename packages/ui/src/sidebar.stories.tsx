import { Document, Folder, Hashtag, ImageReference, Launch, SettingsAdjust, TrashCan } from "@carbon/icons-react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import type * as React from "react";
import { ChangeDot } from "./change-dot";
import { Count } from "./count";
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarHeader,
	SidebarInset,
	SidebarMenu,
	SidebarMenuBadge,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarMenuSub,
	SidebarMenuSubButton,
	SidebarProvider,
	SidebarTrigger,
} from "./sidebar";
import { Heading, Text } from "./text";

function Row({
	icon,
	children,
	count,
	changed,
	...props
}: {
	icon: React.ReactNode;
	children: React.ReactNode;
	count?: number;
	isActive?: boolean;
	removed?: boolean;
	changed?: boolean;
	className?: string;
	disabled?: boolean;
}) {
	return (
		<SidebarMenuItem>
			<SidebarMenuButton {...props}>
				{icon}
				<span>{children}</span>
				{changed && <ChangeDot label="바뀐 곳" />}
				{count !== undefined && <SidebarMenuBadge>{count}</SidebarMenuBadge>}
			</SidebarMenuButton>
		</SidebarMenuItem>
	);
}

/** The rail the admin draws: the site's name, the content rows (the open one has its folders under it), and at the bottom, under a line, the trash and settings. */
function AdminSidebar({ active = "media" }: { active?: "posts" | "media" | "trash" }) {
	return (
		<Sidebar collapsible="none">
			<SidebarHeader>
				<Text variant="title" className="grow">
					example.dev
				</Text>
				<a href="#top" aria-label="사이트 열기" className="flex text-monti-subtle">
					<Launch aria-hidden className="size-4" />
				</a>
			</SidebarHeader>
			<SidebarContent>
				<SidebarGroup>
					<SidebarMenu aria-label="콘텐츠">
						<Row icon={<Document aria-hidden />} count={148} isActive={active === "posts"}>
							게시글
						</Row>
						<Row icon={<Folder aria-hidden />}>카테고리</Row>
						<Row icon={<Hashtag aria-hidden />}>태그</Row>
						<Row icon={<ImageReference aria-hidden />} isActive={active === "media"}>
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
				<SidebarMenu aria-label="휴지통">
					<Row icon={<TrashCan aria-hidden />} count={3} isActive={active === "trash"}>
						휴지통
					</Row>
				</SidebarMenu>
				<SidebarMenu aria-label="설정">
					<Row icon={<SettingsAdjust aria-hidden />}>설정</Row>
				</SidebarMenu>
			</SidebarFooter>
		</Sidebar>
	);
}

/**
 * The left navigation: the tool ground, a line down its right edge, 232px. The open row is on the selected ground and semibold; pointing at
 * another row gives it a paler ground. Counts sit at the end in mono. Drag the edge to change the width.
 */
const meta = {
	title: "Patterns/Frame/Sidebar",
	component: Sidebar,
	args: {},
	parameters: { bleed: true },
	render: () => (
		<SidebarProvider>
			<AdminSidebar />
			<SidebarInset className="gap-monti-16 p-monti-32">
				<Heading variant="page">미디어</Heading>
			</SidebarInset>
		</SidebarProvider>
	),
} satisfies Meta<typeof Sidebar>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

/** Posts open (the folders belong to the media row only), and the trash row open. */
export const OtherRows: Story = {
	render: () => (
		<SidebarProvider className="min-h-96">
			<AdminSidebar active="posts" />
			<AdminSidebar active="trash" />
		</SidebarProvider>
	),
};

/** The open row, a plain row, a row someone is pointing at (paler than the open one), a row with an unsaved change, a removed row, a disabled row. */
export const RowStates: Story = {
	render: () => (
		<SidebarProvider className="min-h-96">
			<Sidebar collapsible="none">
				<SidebarContent>
					<SidebarMenu aria-label="상태">
						<Row icon={<Document aria-hidden />} count={148} isActive>
							열린 줄
						</Row>
						<Row icon={<Folder aria-hidden />}>보통 줄</Row>
						<Row icon={<Hashtag aria-hidden />} className="bg-monti-muted">
							가리킨 줄
						</Row>
						<Row icon={<ImageReference aria-hidden />} changed>
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
			<Sidebar collapsible="none">
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

/** The rail slides away with the trigger (and ⌘B). The drag handle on its edge is there only while it is shown. */
export const Collapsible: Story = {
	render: () => (
		<SidebarProvider>
			<Sidebar>
				<SidebarHeader>
					<Text variant="title">example.dev</Text>
				</SidebarHeader>
				<SidebarContent>
					<SidebarMenu aria-label="콘텐츠">
						<Row icon={<Document aria-hidden />} count={148} isActive>
							게시글
						</Row>
						<Row icon={<ImageReference aria-hidden />}>미디어</Row>
					</SidebarMenu>
				</SidebarContent>
			</Sidebar>
			<SidebarInset className="gap-monti-16 p-monti-32">
				<SidebarTrigger />
				<Heading variant="page">게시글</Heading>
			</SidebarInset>
		</SidebarProvider>
	),
};
