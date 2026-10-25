import type { Meta, StoryObj } from "@storybook/react-vite";
import { FileText, Settings } from "lucide-react";
import { Stack } from "./stack";
import { PageTabs, Tabs, TabsContent, TabsList, TabsTrigger } from "./tabs";
import { Text } from "./text";

const meta = {
	title: "Controls/Tabs",
	component: Tabs,
} satisfies Meta<typeof Tabs>;
export default meta;
type Story = StoryObj<typeof meta>;

function Triggers() {
	return (
		<>
			<TabsTrigger value="write">글</TabsTrigger>
			<TabsTrigger value="seo">검색 노출</TabsTrigger>
			<TabsTrigger value="more">고급</TabsTrigger>
		</>
	);
}

function Panels() {
	return (
		<>
			<TabsContent value="write">
				<Text tone="muted">글 탭의 내용</Text>
			</TabsContent>
			<TabsContent value="seo">
				<Text tone="muted">검색 노출 탭의 내용</Text>
			</TabsContent>
			<TabsContent value="more">
				<Text tone="muted">고급 탭의 내용</Text>
			</TabsContent>
		</>
	);
}

export const Playground: Story = {
	render: (args) => (
		<Tabs defaultValue="write" {...args}>
			<TabsList>
				<Triggers />
			</TabsList>
			<Panels />
		</Tabs>
	),
};

/** `default` is the segmented control, `line` is the underlined bar. */
export const Variants: Story = {
	render: () => (
		<Stack gap="spacious">
			{(["default", "line"] as const).map((variant) => (
				<Tabs key={variant} defaultValue="write">
					<TabsList variant={variant}>
						<Triggers />
					</TabsList>
					<Panels />
				</Tabs>
			))}
		</Stack>
	),
};

export const WithIconsAndDisabled: Story = {
	render: () => (
		<Stack gap="spacious">
			{(["default", "line"] as const).map((variant) => (
				<Tabs key={variant} defaultValue="seo">
					<TabsList variant={variant}>
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
			))}
		</Stack>
	),
};

export const Vertical: Story = {
	render: () => (
		<Stack gap="spacious" direction="row">
			{(["default", "line"] as const).map((variant) => (
				<Tabs key={variant} orientation="vertical" defaultValue="write">
					<TabsList variant={variant}>
						<Triggers />
					</TabsList>
					<Panels />
				</Tabs>
			))}
		</Stack>
	),
};

/** LineTabs is the edge-to-edge bar inside a panel or sheet. */
export const LineTabsBar: Story = {
	render: () => (
		<Tabs defaultValue="write">
			<PageTabs inset="none">
				<Triggers />
			</PageTabs>
			<Panels />
		</Tabs>
	),
};

/** PageTabs is LineTabs with the page gutter. */
export const PageTabsBar: Story = {
	render: () => (
		<Tabs defaultValue="seo">
			<PageTabs>
				<Triggers />
			</PageTabs>
			<Panels />
		</Tabs>
	),
};
