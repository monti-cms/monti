import {
	Button,
	ListSection,
	ListSectionRow,
	MenuField,
	PageBody,
	PageColumn,
	PageHeader,
	PageToolbar,
	Stack,
	TabLink,
	TabLinks,
} from "../../index";
import { AdminFrame } from "./frame";

const KEYS = [
	{ name: "Anthropic 개인", tail: "a1b2", meta: "이번 달 1.24M 토큰" },
	{ name: "OpenAI 회사", tail: "77de", meta: "이번 달 312K 토큰" },
	{ name: "예전 Gemini 키", tail: "9f0c", meta: "이번 달 사용 없음", unused: true },
];

/** The keys plugins ask for, one row per slot; `tail` when a key is in. */
const SLOTS: readonly { id: string; title: string; detail?: string; meta: string; tail?: string }[] = [
	{ id: "bareun", title: "바른 맞춤법", meta: "bareun" },
	{ id: "algolia-search", title: "Algolia 검색", detail: "검색 키", meta: "algolia", tail: "4410" },
	{ id: "algolia-admin", title: "Algolia 검색", detail: "관리 키", meta: "algolia" },
];

/**
 * Tools, API keys tab: three tables. The AI services' keys (the models come from them); the one model this screen picks (the quick task's); the
 * keys plugins ask for, one row per slot. Every key row looks and acts the same: its last four after its name, "편집 · 지우기" when it is in, and
 * "키 넣기" when it is not, all through the same key window (a plugin's has its service set).
 */
/** A key row's actions: change it (the key window) and remove it. */
function KeyActions() {
	return (
		<>
			<Button variant="ghost" size="sm">
				편집
			</Button>
			<Button variant="ghost-danger" size="sm">
				지우기
			</Button>
		</>
	);
}

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
						<ListSection title="AI 키">
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
									actions={<KeyActions />}
								/>
							))}
						</ListSection>
						{/* The one model this screen picks; the list comes from the AI keys above. */}
						<ListSection title="모델">
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
						</ListSection>
						{/* A plugin's slot is a key row like the AI keys: the same window adds and changes it, with its service already set. */}
						<ListSection title="플러그인 키">
							{SLOTS.map((slot) => (
								<ListSectionRow
									key={slot.id}
									title={slot.title}
									detail={slot.detail}
									titleCount={
										slot.tail ? (
											<>
												{"··· "}
												{slot.tail}
											</>
										) : undefined
									}
									meta={slot.meta}
									metaTone="subtle"
									actions={
										slot.tail ? (
											<KeyActions />
										) : (
											<Button variant="ghost" size="sm">
												키 넣기
											</Button>
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
