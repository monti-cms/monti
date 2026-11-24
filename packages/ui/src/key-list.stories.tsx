import type { Meta, StoryObj } from "@storybook/react-vite";
import { OverflowMenuHorizontal } from "./icons";
import {
	Button,
	ControlRow,
	EntryStatus,
	IconButton,
	KeyList,
	KeyListEmpty,
	KeyRow,
	LetterMark,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
	Stack,
} from "./index";

/** 도구 › API 키의 저장된 키 목록(선과 여백, 테두리 표 없음)과 쓰임마다 고른 모델의 행. 키는 끝 네 글자만 보이는 가짜 값이다. */
const meta = {
	title: "Patterns/List/KeyList",
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

const more = (name: string) => (
	<IconButton size="sm" label={`${name} 더 보기`}>
		<OverflowMenuHorizontal aria-hidden />
	</IconButton>
);

/** 확인된 키 둘과 서비스가 받지 않은 키 하나(빨간 말과 "키 바꾸기"), 긴 이름은 줄을 바꾼다. */
export const Keys: Story = {
	render: () => (
		<Stack gap={0} width="content">
			<KeyList>
				<KeyRow
					name="OpenRouter"
					identifier="sk-or-…8e42"
					meta="어시스턴트 · 빠른 작업에 씀"
					status={
						<EntryStatus status="published" quiet>
							확인됨
						</EntryStatus>
					}
					more={more("OpenRouter")}
				/>
				<KeyRow
					name="Google AI Studio"
					identifier="AIza…x9Qe"
					meta="서비스가 이 키를 거부했습니다. 새 키로 바꾸세요."
					metaTone="danger"
					action={
						<Button variant="secondary" size="sm">
							키 바꾸기
						</Button>
					}
					status={<EntryStatus status="failed">거부됨</EntryStatus>}
					more={more("Google AI Studio")}
				/>
				<KeyRow
					name="회사 공용 Azure OpenAI — 콘텐츠팀 번역 전용 배포, 이름이 아주 길어 줄을 바꾼다"
					identifier="contenteam-kr.openai.azure.com"
					meta="Azure OpenAI · 빠른 작업의 번역에만 씀"
					status={
						<EntryStatus status="published" quiet>
							확인됨
						</EntryStatus>
					}
					more={more("Azure OpenAI")}
				/>
			</KeyList>
		</Stack>
	),
};

/** 키가 없을 때: 한 줄과 그 아래 조용한 문장. */
export const Empty: Story = {
	render: () => (
		<Stack gap={0} width="content">
			<KeyList>
				<KeyListEmpty title="아직 키가 없습니다">
					어시스턴트와 빠른 작업을 쓰려면 AI 서비스 키를 하나 추가하세요. 위의 ‘키 추가’에서 서비스를 고를 수 있습니다.
				</KeyListEmpty>
			</KeyList>
		</Stack>
	),
};

/** 쓰임 하나의 모델: 이름과 쓰임 설명, 그 옆의 고르기. */
export const Control: Story = {
	render: () => (
		<Stack gap={0} width="content">
			<ControlRow labelId="story-model" label="어시스턴트" description="대화 · 글 고치기 제안">
				<Select items={[{ value: "gemma", label: "Gemma 4 31B" }]} defaultValue="gemma">
					<SelectTrigger width="full" aria-labelledby="story-model">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="gemma">Gemma 4 31B</SelectItem>
					</SelectContent>
				</Select>
			</ControlRow>
		</Stack>
	),
};

/** 로고가 없는 서비스의 한 글자 표시. */
export const Marks: Story = {
	render: () => (
		<Stack direction="row" gap={8}>
			<LetterMark>O</LetterMark>
			<LetterMark>A</LetterMark>
			<LetterMark>R</LetterMark>
		</Stack>
	),
};
