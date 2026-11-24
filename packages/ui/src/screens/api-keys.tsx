import { Add, Link as LinkIcon, OverflowMenuHorizontal } from "../icons";
import {
	Box,
	Button,
	Combobox,
	ComboboxContent,
	ComboboxGroup,
	ComboboxInput,
	ComboboxItem,
	ComboboxLabel,
	ComboboxList,
	ComboboxScroll,
	ComboboxSeparator,
	ControlRow,
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	EntryStatus,
	FormField,
	FormFieldError,
	FormFieldLabel,
	IconButton,
	Inline,
	Input,
	KeyList,
	KeyListEmpty,
	KeyRow,
	LetterMark,
	MenuValue,
	PageColumn,
	PageHeader,
	SecretInput,
	Section,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
	Stack,
	TabLink,
	TabLinks,
	Text,
} from "../index";
import { Num, ScreenFrame } from "./frame";

/** 저장된 키 하나(지어낸 값: 키는 끝 네 글자만 보인다). */
export interface SavedKey {
	readonly name: string;
	/** 키의 끝("sk-or-…8e42")이나 주소("localhost:11434"). */
	readonly identifier: string;
	readonly meta: string;
	/** 서비스가 키를 받지 않았다. */
	readonly refused?: boolean;
}

/** 시안 `keys7.html`의 키. */
export const KEYS: readonly SavedKey[] = [
	{ name: "OpenRouter", identifier: "sk-or-…8e42", meta: "어시스턴트 · 빠른 작업에 씀" },
	{ name: "Anthropic", identifier: "sk-ant-…11c0", meta: "모델 목록에서 고를 수 있음" },
	{ name: "집 컴퓨터 Ollama", identifier: "localhost:11434", meta: "OpenAI 호환 주소 · 키 없음" },
];

/** 시안 `keys7-many.html`의 키: 거부된 키 하나와 긴 이름. */
export const MANY_KEYS: readonly SavedKey[] = [
	KEYS[0],
	KEYS[1],
	{
		name: "Google AI Studio",
		identifier: "AIza…x9Qe",
		meta: "서비스가 이 키를 거부했습니다. 새 키로 바꾸세요.",
		refused: true,
	},
	{ name: "OpenAI", identifier: "sk-proj-…a71b", meta: "모델 목록에서 고를 수 있음" },
	{
		name: "회사 공용 Azure OpenAI — 콘텐츠팀 번역 전용 배포",
		identifier: "contenteam-kr.openai.azure.com",
		meta: "Azure OpenAI · 빠른 작업의 번역에만 씀",
	},
	{ name: "Mistral AI", identifier: "…3f0c", meta: "모델 목록에서 고를 수 있음" },
	{ name: "DeepSeek", identifier: "sk-…77d2", meta: "모델 목록에서 고를 수 있음" },
	{ name: "Groq", identifier: "gsk_…c4e1", meta: "모델 목록에서 고를 수 있음" },
	KEYS[2],
];

const MODELS = [
	{ value: "gemma-4-31b", label: "Gemma 4 31B", service: "OpenRouter" },
	{ value: "gemini-3-flash", label: "Gemini 3 Flash", service: "OpenRouter" },
] as const;

/** 쓰임 하나의 모델: 모델 이름 뒤에 그 서비스가 흐리게 붙는다. 키가 없으면 고를 것이 없다는 말이 자리 표시로 선다. */
function ModelSelect({ labelId, model }: { labelId: string; model?: (typeof MODELS)[number] }) {
	return (
		<Select items={MODELS.map(({ value, label }) => ({ value, label }))} value={model?.value ?? null}>
			<SelectTrigger width="full" aria-labelledby={labelId}>
				<SelectValue placeholder="키를 추가하면 고를 수 있습니다">
					{model ? (
						<Inline as="span" gap={16} align="baseline">
							{model.label}
							<Text variant="caption" tone="faint">
								{model.service}
							</Text>
						</Inline>
					) : undefined}
				</SelectValue>
			</SelectTrigger>
			<SelectContent>
				{MODELS.map((item) => (
					<SelectItem key={item.value} value={item.value}>
						{item.label}
					</SelectItem>
				))}
			</SelectContent>
		</Select>
	);
}

/** 자주 쓰는 서비스. 글자 표시는 시안대로 둘이 겹치지 않게 고른 한 글자다(OpenAI O, OpenRouter R). */
const FREQUENT = [
	{ name: "OpenAI", letter: "O" },
	{ name: "Anthropic", letter: "A", added: true },
	{ name: "Google AI Studio", letter: "G" },
	{ name: "OpenRouter", letter: "R", added: true },
] as const;

const ALL_SERVICES = [
	"AI21 Labs",
	"Alibaba Cloud · Qwen",
	"Amazon Bedrock",
	"Azure OpenAI",
	"Baseten",
	"Cerebras",
	"Cloudflare Workers AI",
	"Cohere",
	"DeepInfra",
	"DeepSeek",
	"Fireworks AI",
] as const;

const mark = (name: string, letter = name.charAt(0).toUpperCase()) => <LetterMark>{letter}</LetterMark>;

/**
 * 서비스 고르기: 찾기 칸과, 그 칸과 같은 폭으로 아래에 열린 목록. 자주 쓰는 넷은 늘 보이고, 모든 서비스만 그 안에서 스크롤되며, 목록에 없을 때의
 * 호환 주소는 맨 아래에 늘 보인다. 찾는 중이면 찾은 서비스만 보인다.
 */
function ServicePicker({ query }: { query?: string }) {
	const found = query ? ALL_SERVICES.filter((name) => name.toLowerCase().startsWith(query.toLowerCase())) : undefined;
	const items = found ?? [...FREQUENT.map((item) => item.name), ...ALL_SERVICES];
	return (
		<Combobox items={items} defaultOpen inputValue={query ?? ""} filter={null} autoHighlight>
			<ComboboxInput showTrigger={false} placeholder="서비스 이름으로 찾기" aria-label="서비스" autoFocus />
			<ComboboxContent sideOffset={4} width="field">
				<ComboboxList fit="content">
					{found ? (
						<ComboboxGroup>
							<ComboboxLabel>
								‘{query}’ 찾은 서비스
								<span>
									<Num>{found.length}</Num>개
								</span>
							</ComboboxLabel>
							{found.map((name) => (
								<ComboboxItem key={name} value={name}>
									{mark(name)}
									<span>
										<Text weight="semibold">{name.slice(0, query?.length)}</Text>
										{name.slice(query?.length)}
									</span>
								</ComboboxItem>
							))}
						</ComboboxGroup>
					) : (
						<>
							<ComboboxGroup>
								<ComboboxLabel>자주 쓰는 서비스</ComboboxLabel>
								{FREQUENT.map((item) => (
									<ComboboxItem key={item.name} value={item.name}>
										{mark(item.name, item.letter)}
										{item.name}
										{"added" in item ? <MenuValue>추가됨</MenuValue> : null}
									</ComboboxItem>
								))}
							</ComboboxGroup>
							<ComboboxSeparator />
							<ComboboxGroup>
								<ComboboxLabel>
									모든 서비스<span>가나다·ABC 순</span>
								</ComboboxLabel>
								<ComboboxScroll>
									{ALL_SERVICES.map((name) => (
										<ComboboxItem key={name} value={name}>
											{mark(name)}
											{name}
										</ComboboxItem>
									))}
								</ComboboxScroll>
							</ComboboxGroup>
						</>
					)}
					<ComboboxSeparator />
					<ComboboxItem value="compatible">
						<LinkIcon aria-hidden />
						목록에 없나요? OpenAI 호환 주소 직접 넣기
					</ComboboxItem>
				</ComboboxList>
			</ComboboxContent>
		</Combobox>
	);
}

/** "키 추가" 대화상자. `stage`: 서비스를 찾는 중(`pick`, `search`)이거나, 키를 확인했는데 서비스가 받지 않았다(`fail`). */
function AddKeyDialog({ stage }: { stage: "pick" | "search" | "fail" }) {
	return (
		<Dialog defaultOpen>
			<DialogContent size="md" place="top" form>
				<DialogHeader>
					<DialogTitle>키 추가</DialogTitle>
					<DialogDescription>추가하면 서비스에 한 번 접속해 키를 확인합니다.</DialogDescription>
				</DialogHeader>
				<Stack gap={16}>
					<FormField>
						<FormFieldLabel htmlFor="key-service">서비스</FormFieldLabel>
						{stage === "fail" ? (
							<Select items={[{ value: "anthropic", label: "Anthropic" }]} value="anthropic">
								<SelectTrigger id="key-service" width="full">
									<SelectValue>
										<Box as="span">{mark("Anthropic")} Anthropic</Box>
									</SelectValue>
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="anthropic">Anthropic</SelectItem>
								</SelectContent>
							</Select>
						) : (
							<ServicePicker query={stage === "search" ? "deep" : undefined} />
						)}
					</FormField>
					<FormField data-invalid={stage === "fail" || undefined}>
						<FormFieldLabel htmlFor="key-secret">키</FormFieldLabel>
						{stage === "fail" ? (
							<SecretInput
								id="key-secret"
								aria-invalid
								defaultValue="sk-ant-not-a-real-key-Q2a"
								showLabel="키 보기"
								hideLabel="키 가리기"
							/>
						) : (
							<Input id="key-secret" disabled placeholder="서비스를 먼저 고르세요" />
						)}
						{stage === "fail" && (
							<FormFieldError>Anthropic이 이 키를 받지 않았습니다. 키 전체를 다시 복사해 붙여 넣으세요.</FormFieldError>
						)}
					</FormField>
					{stage === "fail" && (
						<FormField>
							<FormFieldLabel htmlFor="key-name">
								이름
								<Text tone="faint" weight="role">
									· 선택
								</Text>
							</FormFieldLabel>
							<Input id="key-name" placeholder="Anthropic" />
						</FormField>
					)}
				</Stack>
				<DialogFooter>
					<Button variant="ghost">취소</Button>
					<Button>{stage === "fail" ? "다시 확인" : "추가"}</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

/**
 * 도구 › API 키(시안 v7 `keys7*.html`). `keys`가 비면 빈 목록과 고를 수 없는 모델. `add`: "키 추가" 대화상자가 열린 단계.
 */
export function ApiKeysScreen({ keys = KEYS, add }: { keys?: readonly SavedKey[]; add?: "pick" | "search" | "fail" }) {
	const empty = keys.length === 0;
	return (
		<ScreenFrame open="tools">
			<PageColumn width="full">
				<Box maxWidth="content">
					<PageHeader layout="bar" title="도구">
						<Button>
							<Add aria-hidden />키 추가
						</Button>
					</PageHeader>
					<nav aria-label="도구">
						<TabLinks variant="page">
							<TabLink href="#templates">템플릿</TabLink>
							<TabLink href="#keys" current>
								API 키
							</TabLink>
						</TabLinks>
					</nav>
					<Section
						layout="grid"
						title="AI 키"
						description="어시스턴트와 빠른 작업이 쓰는 키입니다. 키는 이 서버에만 저장됩니다."
					>
						<KeyList>
							{empty ? (
								<KeyListEmpty title="아직 키가 없습니다">
									어시스턴트와 빠른 작업을 쓰려면 AI 서비스 키를 하나 추가하세요. 위의 ‘키 추가’에서 서비스를 고를 수
									있습니다.
								</KeyListEmpty>
							) : (
								keys.map((key) => (
									<KeyRow
										key={key.name}
										name={key.name}
										identifier={key.identifier}
										meta={key.meta}
										metaTone={key.refused ? "danger" : "subtle"}
										action={
											key.refused ? (
												<Button variant="secondary" size="sm">
													키 바꾸기
												</Button>
											) : undefined
										}
										status={
											key.refused ? (
												<EntryStatus status="failed">거부됨</EntryStatus>
											) : (
												<EntryStatus status="published" quiet>
													확인됨
												</EntryStatus>
											)
										}
										more={
											<IconButton size="sm" label={`${key.name} 더 보기`}>
												<OverflowMenuHorizontal aria-hidden />
											</IconButton>
										}
									/>
								))
							)}
						</KeyList>
					</Section>
					<Section layout="grid" last title="모델" description="키가 있는 서비스의 모델만 보입니다">
						<ControlRow labelId="model-assistant" label="어시스턴트" description="대화 · 글 고치기 제안">
							<ModelSelect labelId="model-assistant" model={empty ? undefined : MODELS[0]} />
						</ControlRow>
						<ControlRow labelId="model-quick" label="빠른 작업" description="채우기 · 요청 · 번역">
							<ModelSelect labelId="model-quick" model={empty ? undefined : MODELS[1]} />
						</ControlRow>
					</Section>
				</Box>
			</PageColumn>
			{add && <AddKeyDialog stage={add} />}
		</ScreenFrame>
	);
}
