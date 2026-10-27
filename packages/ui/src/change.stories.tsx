import type { Meta, StoryObj } from "@storybook/react-vite";
import { ChangeActions, ChangeGroup, ChangeLine, ChangeLines, ChangeNote } from "./change";
import { Checkbox } from "./checkbox";
import { FormField, FormFieldLabel } from "./field";
import { Input } from "./input";
import { Option } from "./option";
import { RadioGroup, RadioItem } from "./radio-group";
import { TextButton } from "./text-button";

/**
 * One change in the review that opens before a schema is saved. A tag for the kind (new green, edit yellow, removed red), the name in bold and its
 * key at the end, then what to do with the data already saved: radio choices, one line for the result, a list of what is affected.
 */
const meta = {
	title: "Change/ChangeGroup",
	component: ChangeGroup,
	args: { kind: "edit", tag: "이름", title: "요약", identifier: "summary → excerpt", children: null },
	decorators: [
		(Story) => (
			<div className="w-[472px] rounded-monti-lg border border-monti-default bg-monti-tool px-monti-24">
				<Story />
			</div>
		),
	],
} satisfies Meta<typeof ChangeGroup>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
	render: (args) => (
		<ChangeGroup {...args}>
			<RadioGroup defaultValue="move" className="gap-monti-10">
				<RadioItem value="move" label="값 옮기기" hint="148편" />
				<RadioItem value="blank" label="빈 칸으로 시작" />
			</RadioGroup>
		</ChangeGroup>
	),
};

/** A renamed field: pick whether the values move with it. */
export const Edit: Story = Playground;

/** A new field starts empty; there is nothing to decide, only a line to say so. */
export const New: Story = {
	args: { kind: "new", tag: "새로", title: "대표 이미지", identifier: "cover" },
	render: (args) => (
		<ChangeGroup {...args}>
			<ChangeNote>기존 글 148편은 빈 칸으로 시작해요.</ChangeNote>
		</ChangeGroup>
	),
};

/** A removed field: keep the values or erase them. Erasing says what is lost and that it cannot be undone. */
export const Drop: Story = {
	args: { kind: "drop", tag: "지움", title: "부제", identifier: "subtitle" },
	render: (args) => (
		<ChangeGroup {...args}>
			<RadioGroup defaultValue="erase" className="gap-monti-10">
				<RadioItem value="keep" label="남겨 두기" hint="132편" />
				<RadioItem value="erase" label="값 지우기" />
			</RadioGroup>
			<ChangeNote danger>132편에서 값이 사라져요. 되돌릴 수 없어요.</ChangeNote>
		</ChangeGroup>
	),
};

/** A removed collection: what goes with it, what blocks it (with the button that clears it), and the identifier to type. */
export const DropCollection: Story = {
	args: { kind: "drop", tag: "지움", title: "메모", identifier: "memo" },
	render: (args) => (
		<ChangeGroup {...args}>
			<ChangeLines>
				<ChangeLine what="글 23편 · 휴지통 2편 포함" then="영구 삭제" tone="danger" />
				<ChangeLine
					what="가리키는 글 4편"
					then={<TextButton className="text-[length:inherit] text-inherit">연결 끊기</TextButton>}
					tone="warning"
				/>
				<ChangeLine what="본문 링크 2곳" then="깨진 링크로 표시" />
			</ChangeLines>
			<FormField>
				<FormFieldLabel htmlFor="confirm-memo">식별자 입력</FormFieldLabel>
				<Input id="confirm-memo" placeholder="memo" className="font-mono" />
			</FormField>
		</ChangeGroup>
	),
};

/** Choices that switch on and off use checks; the buttons that end a change sit in `ChangeActions`. */
export const WithChecks: Story = {
	args: { kind: "edit", tag: "선택지", title: "상태", identifier: "status" },
	render: (args) => (
		<ChangeGroup {...args}>
			<Option>
				<Checkbox defaultChecked />
				초안을 비공개로 바꾸기
			</Option>
			<Option>
				<Checkbox />
				예약된 글은 그대로 두기
			</Option>
			<ChangeActions>
				<TextButton variant="underline">목록에서 보기 →</TextButton>
			</ChangeActions>
		</ChangeGroup>
	),
};

/** Several together, as in the review. */
export const InReview: Story = {
	render: () => (
		<>
			<ChangeGroup kind="edit" tag="이름" title="요약" identifier="summary → excerpt">
				<RadioGroup defaultValue="move" className="gap-monti-10">
					<RadioItem value="move" label="값 옮기기" hint="148편" />
					<RadioItem value="blank" label="빈 칸으로 시작" />
				</RadioGroup>
			</ChangeGroup>
			<ChangeGroup kind="drop" tag="지움" title="부제" identifier="subtitle">
				<RadioGroup defaultValue="erase" className="gap-monti-10">
					<RadioItem value="keep" label="남겨 두기" hint="132편" />
					<RadioItem value="erase" label="값 지우기" />
				</RadioGroup>
				<ChangeNote danger>132편에서 값이 사라져요. 되돌릴 수 없어요.</ChangeNote>
			</ChangeGroup>
			<ChangeGroup kind="new" tag="새로" title="대표 이미지" identifier="cover">
				<ChangeNote>기존 글 148편은 빈 칸으로 시작해요.</ChangeNote>
			</ChangeGroup>
		</>
	),
};
