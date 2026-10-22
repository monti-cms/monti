import type { Meta, StoryObj } from "@storybook/react-vite";
import { Checkbox } from "./checkbox";
import {
	FormField,
	FormFieldContent,
	FormFieldDescription,
	FormFieldError,
	FormFieldGroup,
	FormFieldLabel,
	FormFieldLegend,
	FormFieldSeparator,
	FormFieldSet,
	FormFieldTitle,
} from "./field";
import { Input } from "./input";
import { Label } from "./label";
import { Stack } from "./stack";
import { Switch } from "./switch";
import { Textarea } from "./textarea";

const meta = {
	title: "Controls/Field",
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
			<FormFieldLabel htmlFor="title">글 제목</FormFieldLabel>
			<Input id="title" placeholder="글 제목" />
			<FormFieldDescription>목록과 검색 결과에 보여요.</FormFieldDescription>
		</FormField>
	),
};

/** The plain Label alone, and next to a control it labels. */
export const Labels: Story = {
	render: () => (
		<Stack gap="comfortable">
			<Label>레이블만</Label>
			<Stack direction="row" gap="condensed" align="center">
				<Checkbox id="lbl" />
				<Label htmlFor="lbl">레이블과 체크박스</Label>
			</Stack>
			<Stack direction="row" gap="condensed" align="center">
				<Checkbox id="lbl-d" disabled />
				<Label htmlFor="lbl-d">비활성 체크박스의 레이블</Label>
			</Stack>
		</Stack>
	),
};

/** The three orientations. `responsive` switches to a row at the container width `md`. */
export const Orientations: Story = {
	render: () => (
		<Stack gap="spacious">
			{(["vertical", "horizontal", "responsive"] as const).map((orientation) => (
				<FormField key={orientation} orientation={orientation}>
					<FormFieldContent>
						<FormFieldTitle>{orientation}</FormFieldTitle>
						<FormFieldDescription>예약 발행 허용</FormFieldDescription>
					</FormFieldContent>
					<Switch />
				</FormField>
			))}
		</Stack>
	),
};

export const States: Story = {
	render: () => (
		<FormFieldGroup>
			<FormField>
				<FormFieldLabel htmlFor="s-ok">슬러그</FormFieldLabel>
				<Input id="s-ok" defaultValue="first-post" />
				<FormFieldDescription>주소 끝부분이 돼요.</FormFieldDescription>
			</FormField>
			<FormField data-invalid="true">
				<FormFieldLabel htmlFor="s-bad">슬러그 (오류)</FormFieldLabel>
				<Input id="s-bad" aria-invalid defaultValue="first post" />
				<FormFieldError>공백은 쓸 수 없어요.</FormFieldError>
			</FormField>
			<FormField data-invalid="true">
				<FormFieldLabel htmlFor="s-many">요약 (오류 여러 개)</FormFieldLabel>
				<Textarea id="s-many" aria-invalid />
				<FormFieldError errors={[{ message: "비워 둘 수 없어요." }, { message: "10자 이상 적어 주세요." }]} />
			</FormField>
			<FormField data-disabled="true">
				<FormFieldLabel htmlFor="s-off">작성자 (비활성)</FormFieldLabel>
				<Input id="s-off" disabled defaultValue="홍길동" />
			</FormField>
		</FormFieldGroup>
	),
};

/** A set with a legend, a group of checkbox fields, a separator with text, and cards of choice (a label wrapping a field). */
export const SetAndGroup: Story = {
	render: () => (
		<FormFieldSet>
			<FormFieldLegend>공개 설정</FormFieldLegend>
			<FormFieldGroup>
				<FormField orientation="horizontal">
					<Checkbox id="g1" defaultChecked />
					<FormFieldLabel htmlFor="g1">댓글 허용</FormFieldLabel>
				</FormField>
				<FormField orientation="horizontal">
					<Checkbox id="g2" />
					<FormFieldLabel htmlFor="g2">검색 엔진에 노출</FormFieldLabel>
				</FormField>
				<FormFieldSeparator>또는</FormFieldSeparator>
				<FormFieldLabel htmlFor="c1">
					<FormField orientation="horizontal">
						<FormFieldContent>
							<FormFieldTitle>비공개</FormFieldTitle>
							<FormFieldDescription>나만 볼 수 있어요.</FormFieldDescription>
						</FormFieldContent>
						<Checkbox id="c1" defaultChecked />
					</FormField>
				</FormFieldLabel>
				<FormFieldLabel htmlFor="c2">
					<FormField orientation="horizontal">
						<FormFieldContent>
							<FormFieldTitle>링크 공개</FormFieldTitle>
							<FormFieldDescription>링크를 아는 사람만 볼 수 있어요.</FormFieldDescription>
						</FormFieldContent>
						<Checkbox id="c2" />
					</FormField>
				</FormFieldLabel>
			</FormFieldGroup>
		</FormFieldSet>
	),
};

export const LegendVariants: Story = {
	render: () => (
		<Stack gap="spacious">
			<FormFieldSet>
				<FormFieldLegend variant="legend">legend</FormFieldLegend>
				<FormFieldDescription>소제목 크기의 범례</FormFieldDescription>
			</FormFieldSet>
			<FormFieldSet>
				<FormFieldLegend variant="label">label</FormFieldLegend>
				<FormFieldDescription>레이블 크기의 범례</FormFieldDescription>
			</FormFieldSet>
		</Stack>
	),
};
