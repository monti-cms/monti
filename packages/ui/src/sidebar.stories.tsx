import type { Meta, StoryObj } from "@storybook/react-vite";
import { FileText, FolderOpen, Image, Settings, Trash2 } from "lucide-react";
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarHeader,
	SidebarInset,
	SidebarMenu,
	SidebarMenuBadge,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarProvider,
	SidebarSeparator,
	SidebarTrigger,
} from "./sidebar";
import { Heading, Text } from "./text";

type MenuSize = "default" | "sm" | "lg";
type MenuVariant = "default" | "outline";

function AdminSidebar({
	size = "default",
	variant = "default",
	side,
}: {
	size?: MenuSize;
	variant?: MenuVariant;
	side?: "left" | "right";
}) {
	return (
		<Sidebar collapsible="none" side={side}>
			<SidebarHeader>
				<Heading variant="title">하루의 기록</Heading>
			</SidebarHeader>
			<SidebarSeparator />
			<SidebarContent>
				<SidebarGroup>
					<SidebarGroupLabel>콘텐츠</SidebarGroupLabel>
					<SidebarGroupContent>
						<SidebarMenu>
							<SidebarMenuItem>
								<SidebarMenuButton isActive size={size} variant={variant}>
									<FileText aria-hidden />
									<span>글</span>
								</SidebarMenuButton>
								<SidebarMenuBadge>12</SidebarMenuBadge>
							</SidebarMenuItem>
							<SidebarMenuItem>
								<SidebarMenuButton size={size} variant={variant}>
									<FolderOpen aria-hidden />
									<span>카테고리</span>
								</SidebarMenuButton>
							</SidebarMenuItem>
							<SidebarMenuItem>
								<SidebarMenuButton size={size} variant={variant}>
									<Image aria-hidden />
									<span>미디어</span>
								</SidebarMenuButton>
							</SidebarMenuItem>
							<SidebarMenuItem>
								<SidebarMenuButton size={size} variant={variant}>
									<Trash2 aria-hidden />
									<span>휴지통</span>
								</SidebarMenuButton>
								<SidebarMenuBadge>3</SidebarMenuBadge>
							</SidebarMenuItem>
						</SidebarMenu>
					</SidebarGroupContent>
				</SidebarGroup>
				<SidebarGroup>
					<SidebarGroupLabel>사이트</SidebarGroupLabel>
					<SidebarGroupContent>
						<SidebarMenu>
							<SidebarMenuItem>
								<SidebarMenuButton size={size} variant={variant}>
									<Settings aria-hidden />
									<span>설정</span>
								</SidebarMenuButton>
							</SidebarMenuItem>
							<SidebarMenuItem>
								<SidebarMenuButton size={size} variant={variant} disabled>
									<Settings aria-hidden />
									<span>연동 (준비 중)</span>
								</SidebarMenuButton>
							</SidebarMenuItem>
						</SidebarMenu>
					</SidebarGroupContent>
				</SidebarGroup>
			</SidebarContent>
			<SidebarFooter>
				<Text variant="caption" tone="muted">
					김하루 · 관리자
				</Text>
			</SidebarFooter>
		</Sidebar>
	);
}

const meta = {
	title: "Patterns/Frame/Sidebar",
	component: Sidebar,
	args: {},
	render: () => (
		<SidebarProvider>
			<AdminSidebar />
			<SidebarInset>
				<SidebarTrigger />
				<Heading variant="heading">글</Heading>
			</SidebarInset>
		</SidebarProvider>
	),
} satisfies Meta<typeof Sidebar>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

const SIZES: MenuSize[] = ["default", "sm", "lg"];
const VARIANTS: MenuVariant[] = ["default", "outline"];

/** Every menu button size and variant (`size` x `variant`). The rail is rendered in flow (`collapsible="none"`). */
export const ButtonSizesAndVariants: Story = {
	render: () => (
		<SidebarProvider className="flex-wrap">
			{VARIANTS.flatMap((variant) =>
				SIZES.map((size) => (
					<div key={`${variant}-${size}`} className="border-monti-muted border-r">
						<AdminSidebar size={size} variant={variant} />
					</div>
				)),
			)}
		</SidebarProvider>
	),
};

export const Right: Story = {
	render: () => (
		<SidebarProvider>
			<SidebarInset>
				<Heading variant="heading">글</Heading>
			</SidebarInset>
			<AdminSidebar side="right" />
		</SidebarProvider>
	),
};

export const Empty: Story = {
	render: () => (
		<SidebarProvider>
			<Sidebar collapsible="none">
				<SidebarHeader>
					<Heading variant="title">하루의 기록</Heading>
				</SidebarHeader>
				<SidebarContent>
					<SidebarGroup>
						<SidebarGroupLabel>콘텐츠</SidebarGroupLabel>
						<SidebarGroupContent>
							<Text tone="muted">콘텐츠 종류가 아직 없어요</Text>
						</SidebarGroupContent>
					</SidebarGroup>
				</SidebarContent>
			</Sidebar>
		</SidebarProvider>
	),
};

export const LongLabel: Story = {
	render: () => (
		<SidebarProvider>
			<Sidebar collapsible="none">
				<SidebarContent>
					<SidebarGroup>
						<SidebarGroupContent>
							<SidebarMenu>
								<SidebarMenuItem>
									<SidebarMenuButton isActive>
										<FileText aria-hidden />
										<span>아주 긴 이름의 콘텐츠 종류가 사이드바 폭을 넘으면 잘려요</span>
									</SidebarMenuButton>
									<SidebarMenuBadge>128</SidebarMenuBadge>
								</SidebarMenuItem>
							</SidebarMenu>
						</SidebarGroupContent>
					</SidebarGroup>
				</SidebarContent>
			</Sidebar>
		</SidebarProvider>
	),
};
