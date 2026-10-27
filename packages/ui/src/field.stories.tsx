import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { AiAction } from "./ai-action";
import { Checkbox } from "./checkbox";
import { FormField, FormFieldError, FormFieldGroup, FormFieldLabel, FormFieldLegend, FormFieldSet } from "./field";
import { Input } from "./input";
import { Label } from "./label";
import { Option } from "./option";
import { Stack } from "./stack";
import { Textarea } from "./textarea";

/**
 * A field is a label in mono 11 above its control and, only when something is wrong, one line of error below. The assistant's fill action
 * sits on the label row and shows while the pointer or keyboard is in the field.
 */
const meta = {
	title: "Controls/Field/Field",
	component: FormField,
	decorators: [
		(Story) => (
			<Stack className="max-w-md">
				<Story />
			</Stack>
		),
	],
} satisfies Meta<typeof FormField>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
	render: (args) => (
		<FormField {...args}>
			<FormFieldLabel htmlFor="title">사이트 이름</FormFieldLabel>
			<Input id="title" defaultValue="example.dev" />
		</FormField>
	),
};

/** Plain, mono value, error, disabled. */
export const States: Story = {
	render: () => (
		<FormFieldGroup>
			<FormField>
				<FormFieldLabel htmlFor="s-ok">주소</FormFieldLabel>
				<Input id="s-ok" mono defaultValue="/first-post" />
			</FormField>
			<FormField data-invalid="true">
				<FormFieldLabel htmlFor="s-bad">이름</FormFieldLabel>
				<Input id="s-bad" mono aria-invalid defaultValue="2024-post" />
				<FormFieldError>영문자로 시작해야 해요.</FormFieldError>
			</FormField>
			<FormField data-invalid="true">
				<FormFieldLabel htmlFor="s-many">요약 (오류 여러 개)</FormFieldLabel>
				<Textarea id="s-many" aria-invalid rows={2} />
				<FormFieldError errors={[{ message: "비워 둘 수 없어요." }, { message: "10자 이상 적어 주세요." }]} />
			</FormField>
			<FormField data-disabled="true">
				<FormFieldLabel htmlFor="s-off">작성자</FormFieldLabel>
				<Input id="s-off" disabled defaultValue="홍길동" />
			</FormField>
		</FormFieldGroup>
	),
};

function WithFill({ initial, focus = false }: { initial: string; focus?: boolean }) {
	const [value, setValue] = useState(initial);
	const [proposal, setProposal] = useState(false);
	return (
		<FormField>
			<FormFieldLabel
				htmlFor={`alt-${focus}`}
				action={
					<AiAction
						filled={value !== ""}
						onClick={() => {
							setValue("책상 위의 아침 햇살");
							setProposal(true);
						}}
					/>
				}
			>
				대체 텍스트
			</FormFieldLabel>
			<Input
				id={`alt-${focus}`}
				autoFocus={focus}
				proposal={proposal}
				value={value}
				onChange={(event) => {
					setValue(event.target.value);
					setProposal(false);
				}}
			/>
		</FormField>
	);
}

/**
 * The fill action: "✦ 채우기" while the field is empty, "↻ 다시" once it has a value. Hover or focus the field to show it. What the assistant
 * filled is a proposal (blue) until it is edited.
 */
export const FillAction: Story = {
	render: () => (
		<Stack gap={24}>
			<WithFill initial="" focus />
			<WithFill initial="책상 위의 아침 햇살" />
		</Stack>
	),
};

/**
 * A form with required and optional fields marks the ones to fill in with a red `*` after the label (`required` on the label, and the real
 * `required` on the control). A form whose fields are all required, and a select that always holds a value, get no mark.
 */
export const Required: Story = {
	render: () => (
		<FormFieldGroup>
			<FormField>
				<FormFieldLabel htmlFor="r-name" required>
					이름
				</FormFieldLabel>
				<Input id="r-name" required placeholder="posts" />
			</FormField>
			<FormField>
				<FormFieldLabel htmlFor="r-slug" required>
					식별자
				</FormFieldLabel>
				<Input id="r-slug" mono required placeholder="posts" />
			</FormField>
			<FormField>
				<FormFieldLabel htmlFor="r-desc">설명</FormFieldLabel>
				<Textarea id="r-desc" rows={2} />
			</FormField>
		</FormFieldGroup>
	),
};

/** The plain Label alone, and next to a control it labels. */
export const Labels: Story = {
	render: () => (
		<Stack gap={16}>
			<Label>레이블만</Label>
			<Option>
				<Checkbox />
				레이블과 체크박스
			</Option>
			<Option>
				<Checkbox disabled />
				비활성 체크박스의 레이블
			</Option>
		</Stack>
	),
};

/** A set with a legend over its options, 12px apart. The design system hangs no help line under a legend. */
export const SetAndGroup: Story = {
	render: () => (
		<FormFieldSet>
			<FormFieldLegend variant="label">공개 설정</FormFieldLegend>
			<Stack gap={12}>
				<Option>
					<Checkbox defaultChecked />
					댓글 허용
				</Option>
				<Option>
					<Checkbox />
					검색 엔진에 노출
				</Option>
			</Stack>
		</FormFieldSet>
	),
};
