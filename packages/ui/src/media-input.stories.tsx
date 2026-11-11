import type { Meta, StoryObj } from "@storybook/react-vite";
import { Renew, Settings } from "./icons";
import { FormField, FormFieldError, FormFieldLabel, IconButton, Input, MediaInput, Stack } from "./index";

/** A media field: the same underline as an input, the file's name after a small thumbnail, or the faint placeholder while empty. */
const meta = {
	title: "Controls/Field/MediaInput",
	component: MediaInput,
	tags: ["visual"],
} satisfies Meta<typeof MediaInput>;
export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Empty, chosen, proposed and following another value's file, beside an input of the same size so the lines read as one form. The read-only one (an archived
 * entry) is the name to read: no hand, no tint under the pointer, no ×. Its settings stay, to read what the entry says of the picture.
 */
export const States: Story = {
	render: () => (
		<Stack gap={16} width="panel">
			<FormField>
				<FormFieldLabel htmlFor="summary">요약</FormFieldLabel>
				<Input id="summary" size="sm" placeholder="비어 있음" />
			</FormField>
			<FormField>
				<FormFieldLabel htmlFor="cover-empty">대표 이미지</FormFieldLabel>
				<MediaInput id="cover-empty" size="sm" placeholder="비어 있음" />
			</FormField>
			<FormField>
				<FormFieldLabel htmlFor="cover">대표 이미지</FormFieldLabel>
				<MediaInput id="cover" size="sm" value={{ name: "cover-react.png" }} onClear={() => {}} clearLabel="빼기" />
			</FormField>
			<FormField>
				<FormFieldLabel htmlFor="cover-cut">끊긴 파일</FormFieldLabel>
				<MediaInput
					id="cover-cut"
					size="sm"
					value={{ name: "cover-react.png" }}
					onClear={() => {}}
					clearLabel="빼기"
					action={
						<IconButton label="다시 올리기">
							<Renew aria-hidden />
						</IconButton>
					}
				/>
				<FormFieldError>올리기 실패</FormFieldError>
			</FormField>
			<FormField>
				<FormFieldLabel htmlFor="cover-settings">설정이 있는 이미지</FormFieldLabel>
				<MediaInput
					id="cover-settings"
					size="sm"
					value={{ name: "cover-react.png" }}
					onClear={() => {}}
					clearLabel="빼기"
					action={
						<IconButton label="설정">
							<Settings aria-hidden />
						</IconButton>
					}
				/>
			</FormField>
			<FormField>
				<FormFieldLabel htmlFor="cover-following">번역의 대표 이미지</FormFieldLabel>
				<MediaInput id="cover-following" size="sm" value={{ name: "cover-react.png" }} following />
			</FormField>
			<FormField>
				<FormFieldLabel htmlFor="cover-read">읽기 전용</FormFieldLabel>
				<MediaInput
					id="cover-read"
					size="sm"
					value={{ name: "cover-react.png" }}
					readOnly
					action={
						<IconButton label="설정">
							<Settings aria-hidden />
						</IconButton>
					}
				/>
			</FormField>
			<FormField>
				<FormFieldLabel htmlFor="cover-ai">공유 이미지</FormFieldLabel>
				<MediaInput
					id="cover-ai"
					size="sm"
					value={{ name: "og-react.png" }}
					proposal
					onClear={() => {}}
					clearLabel="빼기"
				/>
			</FormField>
		</Stack>
	),
};
