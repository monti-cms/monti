import type { Meta, StoryObj } from "@storybook/react-vite";
import {
	Button,
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	FormField,
	FormFieldLabel,
	Input,
} from "./index";

/**
 * A modal with a small form (one or two inputs): page ground, an emphasis edge, 420px, the title over an ink rule, Cancel and one pill at the
 * bottom right. Focus goes to the first text field. More inputs belong in a sheet.
 */
const meta = {
	title: "Controls/Overlay/Dialog",
	component: Dialog,
} satisfies Meta<typeof Dialog>;
export default meta;
type Story = StoryObj<typeof meta>;

/** One field under the title. */
export const Form: Story = {
	render: () => (
		<Dialog defaultOpen>
			<DialogContent form>
				<DialogHeader>
					<DialogTitle>언어 직접 입력</DialogTitle>
				</DialogHeader>
				<FormField>
					<FormFieldLabel htmlFor="lang-code">언어 코드</FormFieldLabel>
					<Input id="lang-code" placeholder="예: pt-BR" />
				</FormField>
				<DialogFooter>
					<Button variant="ghost">취소</Button>
					<Button>추가</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	),
};

/** When the title alone does not say what the dialog is about, the name follows it after a dot, quiet. */
export const Of: Story = {
	render: () => (
		<Dialog defaultOpen>
			<DialogContent form>
				<DialogHeader>
					<DialogTitle of="Anthropic 개인">값 바꾸기</DialogTitle>
					<DialogDescription>새 키를 넣으면 이전 키는 바로 지워져요.</DialogDescription>
				</DialogHeader>
				<FormField>
					<FormFieldLabel htmlFor="key">API 키</FormFieldLabel>
					<Input id="key" placeholder="sk-ant-…" />
				</FormField>
				<DialogFooter>
					<Button variant="ghost">취소</Button>
					<Button>저장</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	),
};

/** A long name with no place to break is cut on the title's one line; the title's own words stay whole. */
export const OfLongName: Story = {
	render: () => (
		<Dialog defaultOpen>
			<DialogContent form>
				<DialogHeader>
					<DialogTitle of="anthropic-production-key-for-the-editorial-team-2026-rotation">키 편집</DialogTitle>
				</DialogHeader>
				<FormField>
					<FormFieldLabel htmlFor="key-long">API 키</FormFieldLabel>
					<Input id="key-long" placeholder="sk-ant-…" />
				</FormField>
				<DialogFooter>
					<Button variant="ghost">취소</Button>
					<Button>저장</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	),
};
