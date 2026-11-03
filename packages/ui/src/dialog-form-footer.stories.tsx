import type { Meta, StoryObj } from "@storybook/react-vite";
import {
	Dialog,
	DialogContent,
	DialogFormFooter,
	DialogHeader,
	DialogTitle,
	FormField,
	FormFieldLabel,
	Input,
	Stack,
} from "./index";

/** The footer of a dialog that holds a form: Cancel and one pill; while the request runs the pill shows `busyLabel` with a spinner. */
const meta = {
	title: "Controls/Overlay/DialogFormFooter",
	component: DialogFormFooter,
	args: { onCancel: () => {}, submitLabel: "내보내기", busyLabel: "내보내는 중…" },
	render: (args) => (
		<Dialog defaultOpen>
			<DialogContent form>
				<Stack as="form" gap={16}>
					<DialogHeader>
						<DialogTitle>고른 글 내보내기</DialogTitle>
					</DialogHeader>
					<FormField>
						<FormFieldLabel htmlFor="file-name">파일 이름</FormFieldLabel>
						<Input id="file-name" defaultValue="posts-2026-11" />
					</FormField>
					<DialogFormFooter {...args} />
				</Stack>
			</DialogContent>
		</Dialog>
	),
} satisfies Meta<typeof DialogFormFooter>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Ready: Story = {};

/** The request is running. */
export const Busy: Story = { args: { busy: true } };

/** Nothing to send yet. */
export const Disabled: Story = { args: { disabled: true } };
