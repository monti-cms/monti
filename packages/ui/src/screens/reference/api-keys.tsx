import {
	Box,
	Button,
	Inline,
	ListSection,
	ListSectionRow,
	MenuField,
	PageBody,
	PageColumn,
	PageHeader,
	PageToolbar,
	SavedValue,
	SecretInput,
	Stack,
	TabLink,
	TabLinks,
	TextButton,
} from "../../index";
import { AdminFrame } from "./frame";

const KEYS = [
	{ name: "Anthropic 개인", tail: "a1b2", meta: "이번 달 1.24M 토큰" },
	{ name: "OpenAI 회사", tail: "77de", meta: "이번 달 312K 토큰" },
	{ name: "예전 Gemini 키", tail: "9f0c", meta: "이번 달 사용 없음", unused: true },
];

/** The keys plugins ask for. Each slot is one service's, so its key is typed in its row; `tail` when one is in. */
const SLOTS: readonly { id: string; title: string; detail?: string; meta: string; tail?: string }[] = [
	{ id: "bareun", title: "바른 맞춤법", meta: "bareun" },
	{ id: "algolia-search", title: "Algolia 검색", detail: "검색 키", meta: "algolia", tail: "4410" },
	{ id: "algolia-admin", title: "Algolia 검색", detail: "관리 키", meta: "algolia" },
];

/**
 * Tools, API keys tab: the AI services' keys (the models come from them), and where keys are used. The quick task picks a model from those keys; a
 * plugin's slot takes its own key right in its row (typed hidden, then "넣기"; once in, its last four and "바꾸기 · 지우기").
 */
export function ApiKeysScreen() {
	return (
		<AdminFrame open="tools">
			<PageColumn>
				<PageHeader title="도구">
					<Button>
						{"+"}
						{" 키 추가"}
					</Button>
				</PageHeader>
				<PageToolbar inset>
					<TabLinks variant="toolbar">
						<TabLink>템플릿</TabLink>
						<TabLink>데이터</TabLink>
						<TabLink count="1" countTone="warning">
							활동 기록
						</TabLink>
						<TabLink current>API 키</TabLink>
					</TabLinks>
				</PageToolbar>
				<PageBody>
					<Stack gap={40} paddingTop={32}>
						<ListSection title="저장된 키">
							{KEYS.map((key) => (
								<ListSectionRow
									key={key.name}
									title={key.name}
									titleCount={
										<>
											{"··· "}
											{key.tail}
										</>
									}
									meta={key.meta}
									metaTone={key.unused ? "faint" : "muted"}
									actions={
										<>
											<Button variant="ghost" size="sm">
												편집
											</Button>
											<Button variant="ghost-danger" size="sm">
												지우기
											</Button>
										</>
									}
								/>
							))}
						</ListSection>
						{/* One table of where each key is used: the quick task's model, then the plugins' key slots. */}
						<ListSection title="쓰는 곳">
							<ListSectionRow
								title="빠른 작업"
								labelId="model-quick"
								meta="요약 · 태그 · 대체 텍스트 · 번역 채우기"
								control={
									<MenuField
										aria-labelledby="model-quick"
										size="default"
										mono
										value="claude-haiku-5-5"
										meta="Anthropic 개인"
									/>
								}
							/>
							{SLOTS.map((slot) => (
								<ListSectionRow
									key={slot.id}
									title={slot.title}
									detail={slot.detail}
									meta={slot.meta}
									metaTone="subtle"
									labelId={`slot-${slot.id}`}
									control={
										slot.tail ? (
											<Inline gap={12} align="center">
												<Box grow minWidth={0}>
													<SavedValue action={{ label: "바꾸기", onClick: () => {} }}>
														{"··· "}
														{slot.tail}
													</SavedValue>
												</Box>
												<TextButton variant="quiet">지우기</TextButton>
											</Inline>
										) : (
											<Inline gap={12} align="center">
												<Box grow minWidth={0}>
													<SecretInput
														aria-labelledby={`slot-${slot.id}`}
														placeholder="키 넣기"
														showLabel="키 보기"
														hideLabel="키 숨기기"
													/>
												</Box>
												<Button variant="secondary">넣기</Button>
											</Inline>
										)
									}
								/>
							))}
						</ListSection>
					</Stack>
				</PageBody>
			</PageColumn>
		</AdminFrame>
	);
}
