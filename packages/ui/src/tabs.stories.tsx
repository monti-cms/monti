import type { Meta, StoryObj } from "@storybook/react-vite";
import { FileText, Settings } from "lucide-react";
import { Stack } from "./stack";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./tabs";
import { Text } from "./text";

/**
 * Switches the view in the same place. Three forms: `line` (underlined, the picked one in ink at 600), `bar` (the row at the top of a pane, on a
 * rule) and `toolbar` (the filter row under a page title: bold, no underline). A tab can carry a mono count and a dot for something to handle.
 */
const meta = {
	title: "Controls/Tabs",
	component: Tabs,
} satisfies Meta<typeof Tabs>;
export default meta;
type Story = StoryObj<typeof meta>;

function Panels() {
	return (
		<>
			<TabsContent value="all">
				<Text tone="muted">전체 탭의 내용</Text>
			</TabsContent>
			<TabsContent value="published">
				<Text tone="muted">발행됨 탭의 내용</Text>
			</TabsContent>
			<TabsContent value="draft">
				<Text tone="muted">초안 탭의 내용</Text>
			</TabsContent>
		</>
	);
}

function Status({ variant }: { variant: "line" | "bar" | "toolbar" }) {
	return (
		<Tabs defaultValue="all">
			<TabsList variant={variant} inset="none" aria-label="상태">
				<TabsTrigger value="all" count={148}>
					전체
				</TabsTrigger>
				<TabsTrigger value="published">발행됨</TabsTrigger>
				<TabsTrigger value="draft" count={12}>
					초안
				</TabsTrigger>
			</TabsList>
			<Panels />
		</Tabs>
	);
}

export const Playground: Story = {
	render: (args) => (
		<Tabs defaultValue="all" {...args}>
			<TabsList aria-label="상태">
				<TabsTrigger value="all">전체</TabsTrigger>
				<TabsTrigger value="published">발행됨</TabsTrigger>
				<TabsTrigger value="draft">초안</TabsTrigger>
			</TabsList>
			<Panels />
		</Tabs>
	),
};

/** The three forms with a count on some tabs. */
export const Variants: Story = {
	render: () => (
		<Stack gap={32}>
			<Status variant="line" />
			<Status variant="bar" />
			<Status variant="toolbar" />
		</Stack>
	),
};

/** A dot says this tab has something to handle: warning for an unsaved change, proposal for an assistant suggestion. */
export const Dots: Story = {
	render: () => (
		<Stack gap={32}>
			{(["line", "bar", "toolbar"] as const).map((variant) => (
				<Tabs key={variant} defaultValue="basic">
					<TabsList variant={variant} inset="none" aria-label="설정">
						<TabsTrigger value="basic">기본</TabsTrigger>
						<TabsTrigger value="seo" dot="proposal" dotLabel="제안 있음">
							SEO
						</TabsTrigger>
						<TabsTrigger value="stats" dot="warning" dotLabel="바뀜" count={2}>
							통계
						</TabsTrigger>
					</TabsList>
				</Tabs>
			))}
		</Stack>
	),
};

export const WithIconsAndDisabled: Story = {
	render: () => (
		<Tabs defaultValue="seo">
			<TabsList aria-label="보기">
				<TabsTrigger value="write">
					<FileText aria-hidden />글
				</TabsTrigger>
				<TabsTrigger value="seo">
					<Settings aria-hidden />
					설정
				</TabsTrigger>
				<TabsTrigger value="more" disabled>
					비활성
				</TabsTrigger>
			</TabsList>
		</Tabs>
	),
};

/** `bar` with the page gutter (`inset="page"`) and the panel gutter (the default). */
export const BarInsets: Story = {
	render: () => (
		<Stack gap={24}>
			{(["page", "panel"] as const).map((inset) => (
				<Tabs key={inset} defaultValue="all">
					<TabsList variant="bar" inset={inset} aria-label={inset}>
						<TabsTrigger value="all">전체</TabsTrigger>
						<TabsTrigger value="published">발행됨</TabsTrigger>
					</TabsList>
				</Tabs>
			))}
		</Stack>
	),
};
