import type { Meta, StoryObj } from "@storybook/react-vite";
import { RefreshCw } from "lucide-react";
import { Affix } from "./affix";
import { FormField, FormFieldError, FormFieldLabel } from "./field";
import { IconButton } from "./icon-button";
import { Stack } from "./stack";

/** Only the middle is typed: the fixed ends are faint mono text under the same single underline, so it reads as one address. */
const meta = {
	title: "Controls/Affix",
	component: Affix,
	args: { prefix: "/", suffix: "/:slug", defaultValue: "posts" },
	decorators: [
		(Story) => (
			<Stack className="max-w-sm">
				<Story />
			</Stack>
		),
	],
} satisfies Meta<typeof Affix>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const States: Story = {
	render: () => (
		<Stack gap={24}>
			<FormField>
				<FormFieldLabel htmlFor="a-1">공개 주소</FormFieldLabel>
				<Affix id="a-1" prefix="/" suffix="/:slug" defaultValue="posts" />
			</FormField>
			<FormField data-invalid="true">
				<FormFieldLabel htmlFor="a-2">공개 주소 (오류)</FormFieldLabel>
				<Affix id="a-2" prefix="/" suffix="/:slug" aria-invalid defaultValue="내 글" />
				<FormFieldError>영문 소문자와 -만 쓸 수 있어요.</FormFieldError>
			</FormField>
			<FormField>
				<FormFieldLabel htmlFor="a-3">주소 끝 (다시 만들기 단추)</FormFieldLabel>
				<Affix
					id="a-3"
					defaultValue="first-post"
					action={
						<IconButton label="제목으로 다시 만들기">
							<RefreshCw aria-hidden />
						</IconButton>
					}
				/>
			</FormField>
			<FormField>
				<FormFieldLabel htmlFor="a-4">공개 주소 (제안: 어시스턴트가 씀)</FormFieldLabel>
				<Affix id="a-4" prefix="/" suffix="/:slug" proposal defaultValue="notes" />
			</FormField>
			<Affix prefix="https://" suffix=".dev" disabled defaultValue="example" />
		</Stack>
	),
};
