import type { Meta, StoryObj } from "@storybook/react-vite";
import { Document, Spark } from "./icons";
import {
	Banner,
	Box,
	Button,
	EditorHeader,
	IconButton,
	PageBanner,
	PageBody,
	PageColumn,
	PageHeader,
	Sidebar,
	SidebarContent,
	SidebarGroup,
	SidebarGroupContent,
	SidebarHeader,
	SidebarInset,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarProvider,
	StandalonePage,
	Text,
	TextButton,
} from "./index";

/**
 * A page's own banner: the page renders `PageBanner` where its state lives, and the banner stands at the very top of the screen, edge to edge, under
 * the frame's own banners. The page and its ✦ corner move down under it.
 */
const meta = {
	title: "Patterns/Frame/PageBanner",
	tags: ["visual"],
	parameters: { bleed: true },
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

const refused = <Banner tone="danger" title="저장하지 못했습니다. 다시 시도해 주세요." />;

/** The frame with one page in it. The page's banner is written deep in the page, after its title and its list. */
function Frame({ site, children = refused }: { site?: React.ReactNode; children?: React.ReactNode }) {
	return (
		<SidebarProvider rail={false} onRailChange={() => {}}>
			<Sidebar label="관리자 메뉴">
				<SidebarHeader>
					<Text variant="title" truncate>
						몬티 블로그
					</Text>
				</SidebarHeader>
				<SidebarContent>
					<SidebarGroup>
						<SidebarGroupContent>
							<SidebarMenu aria-label="콘텐츠">
								<SidebarMenuItem>
									<SidebarMenuButton isActive render={<button type="button" aria-current="page" />}>
										<Document />
										<span>설정</span>
									</SidebarMenuButton>
								</SidebarMenuItem>
							</SidebarMenu>
						</SidebarGroupContent>
					</SidebarGroup>
				</SidebarContent>
			</Sidebar>
			<SidebarInset
				fixed
				banner={site}
				corner={
					<IconButton label="어시스턴트 열기">
						<Spark className="size-monti-icon-lg" />
					</IconButton>
				}
			>
				<PageColumn width="list">
					<PageHeader title="설정">
						<Button>저장</Button>
					</PageHeader>
					<PageBody>
						<Text variant="note">컬렉션</Text>
						<PageBanner>{children}</PageBanner>
					</PageBody>
				</PageColumn>
			</SidebarInset>
		</SidebarProvider>
	);
}

/** The page's banner alone: the frame has none of its own. */
export const InFrame: Story = { render: () => <Frame /> };

/** Under the site's banner: the wider matter stays on top. */
export const UnderSiteBanner: Story = {
	render: () => (
		<Frame
			site={
				<Banner tone="danger" title="스키마를 데이터베이스에 적용하지 못했습니다">
					<TextButton>다시 적용</TextButton>
				</Banner>
			}
		/>
	),
};

/** A page with nothing to say: the place takes no room, and the page and the corner stand at the top. */
export const None: Story = { render: () => <Frame>{null}</Frame> };

/** A screen outside the frame (an editor): its banners stand over the head row, the screen's own first, a deeper part's under them. */
export const Standalone: Story = {
	render: () => (
		<StandalonePage banner={<Banner tone="danger" title="로그인이 풀렸습니다" meta="다시 로그인해 주세요" plainMeta />}>
			<EditorHeader>
				<TextButton variant="quiet">게시글</TextButton>
				<Button>저장</Button>
			</EditorHeader>
			<Box padding={24}>
				<Text variant="note">본문</Text>
				<PageBanner>
					<Banner title="한국어 원문 변경" meta="10. 26 · 블록 2개">
						<TextButton>모두 확인</TextButton>
					</Banner>
				</PageBanner>
			</Box>
		</StandalonePage>
	),
};
