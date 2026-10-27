import type { Meta, StoryObj } from "@storybook/react-vite";
import { FileText, Search } from "lucide-react";
import { Button } from "./button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "./empty";
import { Stack } from "./stack";

const meta = {
	title: "Feedback/Empty",
	component: Empty,
	args: {},
	render: (args) => (
		<Empty {...args}>
			<EmptyHeader>
				<EmptyMedia variant="icon">
					<FileText aria-hidden />
				</EmptyMedia>
				<EmptyTitle>아직 글이 없어요</EmptyTitle>
				<EmptyDescription>첫 글을 써서 블로그를 시작해 보세요.</EmptyDescription>
			</EmptyHeader>
			<EmptyContent>
				<Button>새 글 쓰기</Button>
			</EmptyContent>
		</Empty>
	),
} satisfies Meta<typeof Empty>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const MediaVariants: Story = {
	render: () => (
		<Stack gap={24}>
			<Empty>
				<EmptyHeader>
					<EmptyMedia variant="default">
						<Search aria-hidden />
					</EmptyMedia>
					<EmptyTitle>variant default</EmptyTitle>
				</EmptyHeader>
			</Empty>
			<Empty>
				<EmptyHeader>
					<EmptyMedia variant="icon">
						<Search aria-hidden />
					</EmptyMedia>
					<EmptyTitle>variant icon</EmptyTitle>
				</EmptyHeader>
			</Empty>
		</Stack>
	),
};

export const TitleOnly: Story = {
	render: () => (
		<Empty>
			<EmptyHeader>
				<EmptyTitle>휴지통이 비어 있어요</EmptyTitle>
			</EmptyHeader>
		</Empty>
	),
};

export const SearchWithNoResult: Story = {
	render: () => (
		<Empty>
			<EmptyHeader>
				<EmptyMedia variant="icon">
					<Search aria-hidden />
				</EmptyMedia>
				<EmptyTitle>"여름 여행"과 맞는 글이 없어요</EmptyTitle>
				<EmptyDescription>
					다른 단어로 찾아보거나 <a href="#top">필터를 지워</a> 보세요.
				</EmptyDescription>
			</EmptyHeader>
			<EmptyContent>
				<Button variant="outline">필터 지우기</Button>
			</EmptyContent>
		</Empty>
	),
};
