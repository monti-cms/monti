import type { Meta, StoryObj } from "@storybook/react-vite";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./dialog";
import { DialogFormFooter } from "./dialog-form-footer";
import { Stack } from "./stack";
import { Text } from "./text";

const meta = {
	title: "Overlays/DialogFormFooter",
	component: DialogFormFooter,
	args: { onCancel: () => {}, busy: false, disabled: false },
	render: (args) => (
		<Dialog defaultOpen>
			<DialogContent showCloseButton={false}>
				<DialogHeader>
					<DialogTitle>새 글 만들기</DialogTitle>
					<DialogDescription>제목을 정하고 저장해 주세요.</DialogDescription>
				</DialogHeader>
				<form onSubmit={(event) => event.preventDefault()}>
					<DialogFormFooter {...args} />
				</form>
			</DialogContent>
		</Dialog>
	),
} satisfies Meta<typeof DialogFormFooter>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

/** The footer on its own, one row per state. */
export const States: Story = {
	parameters: { layout: "padded" },
	render: () => {
		const rows = [
			{ name: "default", props: {} },
			{ name: "disabled", props: { disabled: true } },
			{ name: "busy", props: { busy: true } },
			{ name: "submitLabel, cancelLabel", props: { submitLabel: "만들기", cancelLabel: "닫기" } },
			{ name: "busy, busyLabel", props: { busy: true, submitLabel: "만들기", busyLabel: "만드는 중…" } },
		];
		return (
			<Stack gap="spacious">
				{rows.map((row) => (
					<Stack key={row.name} gap="tight">
						<Text variant="label" tone="muted">
							{row.name}
						</Text>
						<form onSubmit={(event) => event.preventDefault()}>
							<DialogFormFooter onCancel={() => {}} {...row.props} />
						</form>
					</Stack>
				))}
			</Stack>
		);
	},
};
