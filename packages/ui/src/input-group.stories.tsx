import type { Meta, StoryObj } from "@storybook/react-vite";
import { Search, Send, X } from "lucide-react";
import {
	InputGroup,
	InputGroupAddon,
	InputGroupButton,
	InputGroupInput,
	InputGroupText,
	InputGroupTextarea,
} from "./input-group";
import { Stack } from "./stack";
import { Text } from "./text";

const meta = {
	title: "Controls/InputGroup",
	component: InputGroup,
	decorators: [
		(Story) => (
			<Stack className="max-w-sm">
				<Story />
			</Stack>
		),
	],
} satisfies Meta<typeof InputGroup>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
	render: (args) => (
		<InputGroup {...args}>
			<InputGroupAddon>
				<Search aria-hidden />
			</InputGroupAddon>
			<InputGroupInput placeholder="글 검색" />
		</InputGroup>
	),
};

/** Addons at every side: inline-start, inline-end, block-start, block-end. */
export const Addons: Story = {
	render: () => (
		<Stack gap={16}>
			<InputGroup>
				<InputGroupAddon align="inline-start">
					<InputGroupText>https://</InputGroupText>
				</InputGroupAddon>
				<InputGroupInput placeholder="slug" />
			</InputGroup>
			<InputGroup>
				<InputGroupInput placeholder="슬러그" />
				<InputGroupAddon align="inline-end">
					<InputGroupText>.html</InputGroupText>
				</InputGroupAddon>
			</InputGroup>
			<InputGroup>
				<InputGroupAddon align="block-start">
					<InputGroupText>제목</InputGroupText>
				</InputGroupAddon>
				<InputGroupInput placeholder="글 제목" />
			</InputGroup>
			<InputGroup>
				<InputGroupInput placeholder="글 제목" />
				<InputGroupAddon align="block-end">
					<InputGroupText>0 / 60자</InputGroupText>
				</InputGroupAddon>
			</InputGroup>
		</Stack>
	),
};

/** Every InputGroupButton size, in an end addon. */
export const Buttons: Story = {
	render: () => (
		<Stack gap={16}>
			{(["xs", "sm", "icon-xs", "icon-sm"] as const).map((size) => (
				<InputGroup key={size}>
					<InputGroupInput placeholder={`버튼 크기 ${size}`} />
					<InputGroupAddon align="inline-end">
						{size.startsWith("icon") ? (
							<InputGroupButton size={size} aria-label="지우기">
								<X aria-hidden />
							</InputGroupButton>
						) : (
							<InputGroupButton size={size}>검색</InputGroupButton>
						)}
					</InputGroupAddon>
				</InputGroup>
			))}
			<InputGroup>
				<InputGroupInput placeholder="비활성 버튼" />
				<InputGroupAddon align="inline-end">
					<InputGroupButton variant="default" disabled>
						검색
					</InputGroupButton>
				</InputGroupAddon>
			</InputGroup>
		</Stack>
	),
};

export const States: Story = {
	render: () => (
		<Stack gap={16}>
			<Text variant="caption" tone="muted">
				filled
			</Text>
			<InputGroup>
				<InputGroupAddon>
					<Search aria-hidden />
				</InputGroupAddon>
				<InputGroupInput defaultValue="블로그" />
			</InputGroup>
			<Text variant="caption" tone="muted">
				disabled
			</Text>
			<InputGroup data-disabled="true">
				<InputGroupAddon>
					<Search aria-hidden />
				</InputGroupAddon>
				<InputGroupInput disabled placeholder="글 검색" />
			</InputGroup>
			<Text variant="caption" tone="muted">
				invalid
			</Text>
			<InputGroup>
				<InputGroupAddon>
					<Search aria-hidden />
				</InputGroupAddon>
				<InputGroupInput aria-invalid defaultValue="@@" />
			</InputGroup>
		</Stack>
	),
};

export const WithTextarea: Story = {
	render: () => (
		<Stack gap={16}>
			<InputGroup>
				<InputGroupTextarea placeholder="댓글 쓰기" />
				<InputGroupAddon align="block-end">
					<InputGroupText>0 / 300자</InputGroupText>
					<InputGroupButton variant="default" className="ml-auto">
						<Send aria-hidden />
						보내기
					</InputGroupButton>
				</InputGroupAddon>
			</InputGroup>
			<InputGroup>
				<InputGroupTextarea aria-invalid defaultValue="너무 긴 댓글" />
			</InputGroup>
		</Stack>
	),
};
