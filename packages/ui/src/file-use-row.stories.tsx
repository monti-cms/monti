import type { Meta, StoryObj } from "@storybook/react-vite";
import { FileUseList, FileUseRow, FormField, FormFieldLabel, Stack } from "./index";

/** The places that use a file, in its panel: one row each, the title cut before it can push its places out. */
const meta = {
	title: "Patterns/List/FileUseRow",
	component: FileUseRow,
	tags: ["visual"],
} satisfies Meta<typeof FileUseRow>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Under their label, as a panel shows them: short titles, and one too long for the panel's width. */
export const Rows: Story = {
	args: { title: "", places: "", href: "#" },
	render: () => (
		<Stack gap={4} width="panel">
			<FormField>
				<FormFieldLabel>쓰는 곳 · 3</FormFieldLabel>
				<FileUseList>
					<FileUseRow title="개발자의 책상" places="본문" href="#" />
					<FileUseRow title="보안 이야기" places="대표 이미지 · 본문" href="#" />
					<FileUseRow
						title="봄맞이 블로그 개편 회고: 무엇을 바꾸고 무엇을 남겼는지에 대하여"
						places="대표 이미지 · 본문"
						href="#"
					/>
				</FileUseList>
			</FormField>
		</Stack>
	),
};
