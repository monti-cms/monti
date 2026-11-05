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

const SLOTS = [
	{ id: "bareun", title: "바른 맞춤법", meta: "bareun" },
	{ id: "algolia-search", title: "Algolia 검색", detail: "검색 키", meta: "algolia" },
	{ id: "algolia-admin", title: "Algolia 검색", detail: "관리 키", meta: "algolia" },
];

/** Tools, API keys tab: the saved keys, and where they are used (the quick task's model, the keys plugins ask for). */
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
										<MenuField aria-labelledby={`slot-${slot.id}`} placeholder="키 없음" size="default" warning />
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
