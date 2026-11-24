import type { Meta, StoryObj } from "@storybook/react-vite";
import { AddressExample, AddressExampleRow, AddressPart } from "./address-example";
import { Stack } from "./stack";

/** 주소 설정 아래의 예시: 줄마다 이름과 주소, 설정이 정하는 토막은 먹색 600에 고른 바탕. */
const meta = {
	title: "Controls/Field/AddressExample",
	component: AddressExample,
	decorators: [
		(Story) => (
			<Stack className="max-w-lg">
				<Story />
			</Stack>
		),
	],
} satisfies Meta<typeof AddressExample>;
export default meta;
type Story = StoryObj<typeof meta>;

/** 설정 › 사이트의 "주소에 언어 표시": 언어마다 한 줄. */
export const Languages: Story = {
	render: () => (
		<AddressExample>
			<AddressExampleRow label="한국어 · 원문">example.com/articles/first-walk</AddressExampleRow>
			<AddressExampleRow label="English">
				example.com/<AddressPart>en</AddressPart>/articles/first-walk
			</AddressExampleRow>
		</AddressExample>
	),
};

/** 컬렉션의 공개 주소: "예" 한 줄, 이름 열 44px. */
export const Short: Story = {
	render: () => (
		<AddressExample label="short">
			<AddressExampleRow label="예">
				example.com/<AddressPart>articles</AddressPart>/first-walk
			</AddressExampleRow>
		</AddressExample>
	),
};
