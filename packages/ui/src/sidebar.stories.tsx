import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { Document, Image as ImageIcon, Settings, Tools, TrashCan } from "./icons";
import {
	Box,
	Count,
	folderTree,
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
	Text,
} from "./index";

/**
 * The left navigation on the cream tool ground: the site's name and the fold button, the content, and under a line the trash, the tools and the settings.
 * The open row is on the current ground and semibold; a row under the pointer takes the selected ground. Folded (⌘B) it is a 48px rail of icons.
 */
const FOLDERS = [
	{ name: "에세이", count: "12", depth: 0, active: true },
	{ name: "여행", count: "5", depth: 1 },
	{ name: "회고", count: "3", depth: 1 },
	{ name: "시리즈 원고", count: "2", depth: 0 },
] as const;
const TREE = folderTree(FOLDERS.map((folder) => folder.depth));

const meta = {
	title: "Patterns/Frame/Sidebar",
	parameters: { bleed: true },
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

/** Stands in for the app's router link. */
const RouterLink = (props: React.ComponentProps<"a">) => <a {...props} />;

function Nav({ rail = false }: { rail?: boolean }) {
	const [mode, setMode] = useState<"system" | "light" | "dark">("system");
	return (
		<SidebarProvider rail={rail} onRailChange={() => {}}>
			<Sidebar label="관리자 메뉴">
				<SidebarHeader>
					<Text variant="title" truncate>
						몬티 블로그
					</Text>
					<SidebarRailToggle />
				</SidebarHeader>
				<SidebarContent>
					<SidebarGroup>
						<SidebarGroupContent>
							<SidebarMenu aria-label="콘텐츠">
								<SidebarMenuItem>
									<SidebarMenuButton
										isActive
										tooltip="게시글 148"
										render={<RouterLink href="#posts" aria-current="page" />}
									>
										<Document />
										<span>게시글</span>
										<SidebarMenuBadge>148</SidebarMenuBadge>
									</SidebarMenuButton>
									{!rail && (
										<SidebarMenuSub aria-label="게시글 폴더">
											{FOLDERS.map((folder, index) => (
												<li key={folder.name}>
													<SidebarMenuSubButton
														render={<button type="button" />}
														isActive={"active" in folder}
														depth={folder.depth}
														tree={TREE[index]}
													>
														<span>{folder.name}</span>
														<Count>{folder.count}</Count>
													</SidebarMenuSubButton>
												</li>
											))}
										</SidebarMenuSub>
									)}
								</SidebarMenuItem>
								<SidebarMenuItem>
									<SidebarMenuButton tooltip="미디어" render={<RouterLink href="#media" />}>
										<ImageIcon />
										<span>미디어</span>
									</SidebarMenuButton>
								</SidebarMenuItem>
							</SidebarMenu>
						</SidebarGroupContent>
					</SidebarGroup>
				</SidebarContent>
				<SidebarFooter>
					<SidebarMenu aria-label="관리">
						<SidebarMenuItem>
							<SidebarMenuButton tooltip="휴지통 6" render={<RouterLink href="#trash" />}>
								<TrashCan />
								<span>휴지통</span>
								<SidebarMenuBadge>6</SidebarMenuBadge>
							</SidebarMenuButton>
						</SidebarMenuItem>
						<SidebarMenuItem>
							<SidebarMenuButton tooltip="도구 1" railDot="실패한 전송" render={<RouterLink href="#tools" />}>
								<Tools />
								<span>도구</span>
								<SidebarMenuBadge tone="warning">1</SidebarMenuBadge>
							</SidebarMenuButton>
						</SidebarMenuItem>
						<SidebarMenuItem>
							<SidebarMenuButton tooltip="설정" render={<RouterLink href="#settings" />}>
								<Settings />
								<span>설정</span>
							</SidebarMenuButton>
						</SidebarMenuItem>
					</SidebarMenu>
					<SidebarFoot>
						<SidebarScreenMode
							value={mode}
							onValueChange={setMode}
							labels={{ label: "화면 모드", system: "시스템", light: "밝게", dark: "어둡게" }}
						/>
					</SidebarFoot>
				</SidebarFooter>
			</Sidebar>
			<SidebarInset fixed>
				<Box padding={24}>
					<Text variant="note">페이지</Text>
				</Box>
			</SidebarInset>
		</SidebarProvider>
	);
}

/** Open: names, counts, the open collection's folder tree, the screen mode switch at the bottom. */
export const Open: Story = { render: () => <Nav /> };

/** Folded to the rail: icons only, names in tooltips, a dot on the tools icon for a failure. */
export const Rail: Story = { render: () => <Nav rail /> };
