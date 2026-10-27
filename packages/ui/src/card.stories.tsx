import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "./button";
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle, Panel } from "./card";
import { Stack } from "./stack";
import { Text } from "./text";

const meta = {
	title: "Layout/Card",
	component: Card,
	args: { size: "default" },
	render: (args) => (
		<Card {...args} className="max-w-sm">
			<CardHeader>
				<CardTitle>블로그 정보</CardTitle>
				<CardDescription>사이트 이름과 소개를 바꿀 수 있어요.</CardDescription>
			</CardHeader>
			<CardContent>
				<Text>이름: 하루의 기록</Text>
				<Text tone="muted">소개: 일상과 여행을 적는 블로그</Text>
			</CardContent>
			<CardFooter>
				<Button>저장</Button>
			</CardFooter>
		</Card>
	),
} satisfies Meta<typeof Card>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Sizes: Story = {
	render: () => (
		<Stack direction="row" gap={24} align="start" wrap>
			{(["default", "sm"] as const).map((size) => (
				<Card key={size} size={size} className="w-72">
					<CardHeader>
						<CardTitle>size {size}</CardTitle>
						<CardDescription>카드 안쪽 여백이 달라져요.</CardDescription>
					</CardHeader>
					<CardContent>
						<Text>본문</Text>
					</CardContent>
				</Card>
			))}
		</Stack>
	),
};

export const WithAction: Story = {
	render: () => (
		<Card className="max-w-sm">
			<CardHeader>
				<CardTitle>댓글</CardTitle>
				<CardDescription>승인을 기다리는 댓글이 3개 있어요.</CardDescription>
				<CardAction>
					<Button size="sm" variant="secondary">
						모두 보기
					</Button>
				</CardAction>
			</CardHeader>
		</Card>
	),
};

/** `border-b` on the header and `border-t` on the footer switch on their padding. */
export const WithDividers: Story = {
	render: () => (
		<Card className="max-w-sm">
			<CardHeader className="border-b">
				<CardTitle>글 삭제</CardTitle>
			</CardHeader>
			<CardContent>
				<Text tone="muted">삭제한 글은 30일 동안 휴지통에 남아요.</Text>
			</CardContent>
			<CardFooter className="border-t">
				<Button variant="outline-danger">휴지통으로 이동</Button>
			</CardFooter>
		</Card>
	),
};

export const WithImageFirst: Story = {
	render: () => (
		<Card className="max-w-sm">
			<img
				alt="대표 이미지"
				width={384}
				height={160}
				src="data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='384' height='160'%3E%3Crect width='384' height='160' fill='%23ccc'/%3E%3C/svg%3E"
			/>
			<CardHeader>
				<CardTitle>여름 여행 기록</CardTitle>
				<CardDescription>발행됨</CardDescription>
			</CardHeader>
		</Card>
	),
};

export const LongTitle: Story = {
	render: () => (
		<Card className="max-w-xs">
			<CardHeader>
				<CardTitle>아주 긴 제목의 글이 카드 안에서 어떻게 줄바꿈되는지 확인하기 위한 제목입니다</CardTitle>
				<CardDescription>설명도 길어지면 여러 줄로 이어져요. 줄 사이 간격이 일정한지 봐 주세요.</CardDescription>
			</CardHeader>
		</Card>
	),
};

/** Panel is the plain bordered surface: a border where Card uses a ring. */
export const PanelSurface: Story = {
	render: () => (
		<Panel className="max-w-sm p-4">
			<Text>Panel: 목록이나 표를 담는 단순한 면</Text>
		</Panel>
	),
};
