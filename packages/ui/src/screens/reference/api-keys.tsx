import { type ReactNode, useEffect } from "react";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	Banner,
	Button,
	Count,
	DescriptionItem,
	DescriptionList,
	Dialog,
	DialogContent,
	DialogFooter,
	DialogFormFooter,
	DialogHeader,
	DialogTitle,
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
	Empty,
	FormField,
	FormFieldDescription,
	FormFieldError,
	FormFieldLabel,
	Inline,
	Input,
	ListSection,
	ListSectionRow,
	MenuField,
	ModelMenu,
	PageBody,
	PageColumn,
	PageHeader,
	PageToolbar,
	PickList,
	PickListItem,
	RowActions,
	RowMore,
	SavedValue,
	SecretInput,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
	Stack,
	TabLink,
	TabLinks,
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
	Text,
	Toaster,
	toast,
} from "../../index";
import { AdminFrame } from "./frame";

/** A key row: its name and the key's end, and in "이번 달" the tokens it used. */
type Key = { name: string; tail?: string; meta: string; tone?: "faint" | "danger" };

const KEYS: readonly Key[] = [
	{ name: "Anthropic 개인", tail: "a1b2", meta: "1.24M 토큰" },
	{ name: "OpenRouter", tail: "8e42", meta: "701K 토큰" },
	{ name: "예전 Gemini 키", tail: "9f0c", meta: "사용 없음", tone: "faint" },
];

/** The keys plugins ask for, one row per slot; `tail` when a key is in. */
type Slot = { id: string; title: string; detail?: string; meta: string; tail?: string };

const SLOTS: readonly Slot[] = [
	{ id: "bareun", title: "바른 맞춤법", meta: "bareun" },
	{ id: "algolia-search", title: "Algolia 검색", detail: "검색 키", meta: "algolia", tail: "4410" },
	{ id: "algolia-admin", title: "Algolia 검색", detail: "관리 키", meta: "algolia" },
];

const SERVICES = ["Anthropic", "OpenAI", "OpenRouter", "Google", "OpenAI 호환 주소"];

/** The models of the keys by name, each with its id in its tooltip, and what an alias stands for. */
const MODELS = [
	{
		key: "anthropic",
		label: "Anthropic 개인",
		count: 3,
		items: [
			{ value: "a:claude-haiku-5-5", model: "Claude Haiku 5.5", id: "claude-haiku-5-5", title: "claude-haiku-5-5" },
			{ value: "a:claude-opus-5-5", model: "Claude Opus 5.5", id: "claude-opus-5-5", title: "claude-opus-5-5" },
			{ value: "a:claude-sonnet-5-5", model: "Claude Sonnet 5.5", id: "claude-sonnet-5-5", title: "claude-sonnet-5-5" },
		],
	},
	{
		key: "openrouter",
		label: "OpenRouter",
		count: 3,
		items: [
			{
				value: "o:~deepseek/deepseek-pro-latest",
				model: "DeepSeek: DeepSeek Pro Latest",
				id: "~deepseek/deepseek-pro-latest",
				title: "~deepseek/deepseek-pro-latest\n지금: DeepSeek: DeepSeek V4 Pro",
			},
			{
				value: "o:meta-llama/llama-4-maverick:free",
				model: "Meta: Llama 4 Maverick (free)",
				id: "meta-llama/llama-4-maverick:free",
				title: "meta-llama/llama-4-maverick:free\n입력 한도 1.05M 토큰",
			},
			{
				value: "o:openai/gpt-5.4-mini",
				model: "OpenAI: GPT-5.4 Mini",
				id: "openai/gpt-5.4-mini",
				title: "openai/gpt-5.4-mini\n입력 한도 400K 토큰",
			},
		],
	},
];

/** Every state of the API keys screen (screens.md › ApiKeys, flow 10), named as the flow names it. */
export type ApiKeysStage =
	| "기본"
	| "줄 메뉴"
	| "키 없음"
	| "서비스 고르기"
	| "키 입력"
	| "호환 주소"
	| "확인하는 중"
	| "키 거절"
	| "서비스 답 없음"
	| "이름 겹침"
	| "빈 칸"
	| "추가됨"
	| "편집"
	| "편집 키 열기"
	| "편집 확인 중"
	| "편집 저장됨"
	| "지우기 확인"
	| "쓰는 곳 없이 지우기"
	| "지움"
	| "키 넣기"
	| "키 넣음"
	| "모델 고르기"
	| "모델 바뀜"
	| "읽을 수 없음"
	| "다시 넣기"
	| "비밀값 없음"
	| "비밀값 없음 · 키 있음";

/** A toast that stays, for a still picture of the moment after an action. */
function Said({ children }: { children: string }) {
	useEffect(() => {
		toast(children);
		return () => {
			toast.dismiss();
		};
	}, [children]);
	return <Toaster duration={Number.POSITIVE_INFINITY} />;
}

/** A key row's ⋯: change it (the key window) and remove it. A site that cannot store keys only removes. */
function KeyMenu({ edit = true, open }: { edit?: boolean; open?: boolean }) {
	return (
		<RowActions>
			<DropdownMenu {...(open ? { open } : {})}>
				<RowMore label="더 보기" trigger={(button) => <DropdownMenuTrigger render={button} />} />
				<DropdownMenuContent align="end">
					{edit && (
						<>
							<DropdownMenuItem>편집</DropdownMenuItem>
							<DropdownMenuSeparator />
						</>
					)}
					<DropdownMenuItem variant="danger">지우기</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>
		</RowActions>
	);
}

/** The column names over a list of keys, and an empty one over the rows' ⋯. */
function KeysHead({ columns }: { columns: readonly string[] }) {
	return (
		<TableHeader>
			<TableRow>
				{columns.map((name) => (
					<TableHead key={name} scope="col">
						{name}
					</TableHead>
				))}
				<TableHead aria-hidden />
			</TableRow>
		</TableHeader>
	);
}

/** A key row's name with the key's end after it, and under them what there is to say of it (a slot's plugin code). */
function KeyName({
	name,
	detail,
	tail,
	meta,
	tone = "subtle",
	mono = false,
}: {
	name: string;
	detail?: string;
	tail?: string;
	/** The line under the name; left out, the name stands alone (an AI key's use is in its own column). */
	meta?: string;
	tone?: "subtle" | "faint" | "danger";
	mono?: boolean;
}) {
	return (
		<Stack gap={4} minWidth={0}>
			<Inline gap={8} align="baseline">
				<Text truncate tone={tone === "faint" ? "muted" : "default"}>
					{name}
				</Text>
				{detail ? (
					<Text variant="note" tone="subtle">
						{detail}
					</Text>
				) : null}
				{tail ? (
					<Count>
						{"…"}
						{tail}
					</Count>
				) : null}
			</Inline>
			{meta ? (
				<Text as="div" variant={mono ? "meta" : "note"} mono={mono} tone={tone} truncate>
					{meta}
				</Text>
			) : null}
		</Stack>
	);
}

/** The key window: adds a key or changes one. `service` as text when it cannot change (an edit, a plugin's slot). */
function KeyWindow({
	title,
	of,
	service,
	fixedService = false,
	address,
	addressError,
	name,
	nameNote,
	nameError,
	keyField,
	keyOptional = false,
	keyNote,
	keyError,
	submit = "추가",
	busy = false,
}: {
	title: string;
	of?: string;
	service: string;
	fixedService?: boolean;
	address?: string;
	addressError?: string;
	/** Left out for a plugin's slot: its row is called by its plugin, so the window asks for no name. */
	name?: string;
	nameNote?: string;
	nameError?: string;
	keyField: ReactNode;
	/** The service may take no key: the window then has an optional field, so the required ones carry the star (the label's rule). */
	keyOptional?: boolean;
	keyNote?: string;
	keyError?: string;
	submit?: string;
	busy?: boolean;
}) {
	return (
		<Dialog defaultOpen>
			<DialogContent form>
				<Stack as="form" gap={16}>
					<DialogHeader>
						<DialogTitle of={of}>{title}</DialogTitle>
					</DialogHeader>
					<FormField>
						<FormFieldLabel htmlFor={fixedService ? undefined : "key-service"}>서비스</FormFieldLabel>
						{fixedService ? (
							<Text>{service}</Text>
						) : (
							<Select items={SERVICES.map((value) => ({ value, label: value }))} defaultValue={service}>
								<SelectTrigger id="key-service" width="full">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{SERVICES.map((value) => (
										<SelectItem key={value} value={value}>
											{value}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						)}
					</FormField>
					{address !== undefined && (
						<FormField>
							<FormFieldLabel htmlFor="key-address" required={keyOptional}>
								주소
							</FormFieldLabel>
							<Input id="key-address" mono required defaultValue={address} aria-invalid={addressError !== undefined} />
							{addressError && <FormFieldError>{addressError}</FormFieldError>}
						</FormField>
					)}
					{name !== undefined && (
						<FormField>
							<FormFieldLabel htmlFor="key-name" required={keyOptional}>
								이름
							</FormFieldLabel>
							<Input id="key-name" required defaultValue={name} aria-invalid={nameError !== undefined} />
							{nameNote && <FormFieldDescription>{nameNote}</FormFieldDescription>}
							{nameError && <FormFieldError>{nameError}</FormFieldError>}
						</FormField>
					)}
					<FormField>
						<FormFieldLabel htmlFor="key-secret">키</FormFieldLabel>
						{keyField}
						{keyNote && <FormFieldDescription>{keyNote}</FormFieldDescription>}
						{keyError && <FormFieldError>{keyError}</FormFieldError>}
					</FormField>
					<DialogFormFooter onCancel={() => {}} submitLabel={submit} busy={busy} busyLabel="확인하는 중…" />
				</Stack>
			</DialogContent>
		</Dialog>
	);
}

const secret = (props: Partial<React.ComponentProps<typeof SecretInput>> = {}) => (
	<SecretInput id="key-secret" showLabel="키 보기" hideLabel="키 가리기" placeholder="sk-ant-…" {...props} />
);

const TYPED = "sk-ant-api03-Qx7mR2vLp9TzW4nB8cKd";

function Floating({ stage }: { stage: ApiKeysStage }) {
	switch (stage) {
		case "서비스 고르기":
			return (
				<Dialog defaultOpen>
					<DialogContent>
						<DialogHeader>
							<DialogTitle>키 추가</DialogTitle>
						</DialogHeader>
						<PickList aria-label="서비스">
							{SERVICES.map((service) => (
								<PickListItem key={service}>{service}</PickListItem>
							))}
						</PickList>
						<DialogFooter>
							<Button variant="ghost">취소</Button>
						</DialogFooter>
					</DialogContent>
				</Dialog>
			);
		case "키 입력":
			return <KeyWindow title="키 추가" service="Anthropic" name="Anthropic" keyField={secret({ autoFocus: true })} />;
		case "호환 주소":
			return (
				<KeyWindow
					title="키 추가"
					service="OpenAI 호환 주소"
					address="http://localhost:11434/v1"
					name="localhost:11434"
					keyOptional
					keyField={secret({ placeholder: "없음" })}
				/>
			);
		case "확인하는 중":
			return (
				<KeyWindow
					title="키 추가"
					service="Anthropic"
					name="Anthropic"
					keyField={secret({ defaultValue: TYPED })}
					busy
				/>
			);
		case "키 거절":
			return (
				<KeyWindow
					title="키 추가"
					service="Anthropic"
					name="Anthropic"
					keyField={secret({ defaultValue: TYPED, "aria-invalid": true })}
					keyError="맞지 않는 키입니다."
				/>
			);
		case "서비스 답 없음":
			return (
				<KeyWindow
					title="키 추가"
					service="Anthropic"
					name="Anthropic"
					keyField={secret({ defaultValue: TYPED, "aria-invalid": true })}
					keyError="서비스가 답하지 않습니다."
				/>
			);
		case "이름 겹침":
			return (
				<KeyWindow
					title="키 추가"
					service="Anthropic"
					name="Anthropic 2"
					nameNote="이름이 Anthropic인 키가 이미 있습니다."
					keyField={secret({ autoFocus: true })}
				/>
			);
		case "빈 칸":
			return (
				<KeyWindow
					title="키 추가"
					service="Anthropic"
					name="Anthropic"
					keyField={secret({ "aria-invalid": true, autoFocus: true })}
					keyError="이 칸을 채워 주세요."
				/>
			);
		case "편집":
			return (
				<KeyWindow
					title="편집"
					of="Anthropic 개인"
					service="Anthropic"
					fixedService
					name="Anthropic 개인"
					keyField={<SavedValue action={{ label: "바꾸기", onClick: () => {} }}>··· a1b2</SavedValue>}
					submit="저장"
				/>
			);
		case "편집 키 열기":
			return (
				<KeyWindow
					title="편집"
					of="Anthropic 개인"
					service="Anthropic"
					fixedService
					name="Anthropic 개인"
					keyField={secret({ placeholder: "", autoFocus: true, keep: { label: "그대로", onClick: () => {} } })}
					submit="저장"
				/>
			);
		case "편집 확인 중":
			return (
				<KeyWindow
					title="편집"
					of="Anthropic 개인"
					service="Anthropic"
					fixedService
					name="Anthropic 개인"
					keyField={secret({ defaultValue: TYPED, keep: { label: "그대로", onClick: () => {} } })}
					submit="저장"
					busy
				/>
			);
		case "다시 넣기":
			return (
				<KeyWindow
					title="편집"
					of="Anthropic 개인"
					service="Anthropic"
					fixedService
					name="Anthropic 개인"
					keyField={secret({ placeholder: "", autoFocus: true, required: true })}
					keyNote="키를 다시 넣어 주세요."
					submit="저장"
				/>
			);
		case "키 넣기":
			return (
				<KeyWindow
					title="키 넣기"
					of="바른 맞춤법"
					service="bareun"
					fixedService
					keyField={secret({ placeholder: "", autoFocus: true })}
				/>
			);
		case "지우기 확인":
			return (
				<AlertDialog defaultOpen>
					<AlertDialogContent>
						<AlertDialogHeader>
							<AlertDialogTitle>키를 지울까요?</AlertDialogTitle>
							<AlertDialogDescription>되돌릴 수 없습니다. 이 키를 쓰는 곳이 멈춥니다.</AlertDialogDescription>
						</AlertDialogHeader>
						<DescriptionList>
							<DescriptionItem label="이름">Anthropic 개인</DescriptionItem>
							<DescriptionItem label="어시스턴트" mono>
								claude-sonnet-5-5
							</DescriptionItem>
							<DescriptionItem label="빠른 작업" mono>
								claude-haiku-5-5
							</DescriptionItem>
						</DescriptionList>
						<AlertDialogFooter>
							<AlertDialogCancel>취소</AlertDialogCancel>
							<AlertDialogAction variant="danger">지우기</AlertDialogAction>
						</AlertDialogFooter>
					</AlertDialogContent>
				</AlertDialog>
			);
		case "쓰는 곳 없이 지우기":
			return (
				<AlertDialog defaultOpen>
					<AlertDialogContent>
						<AlertDialogHeader>
							<AlertDialogTitle>키를 지울까요?</AlertDialogTitle>
							<AlertDialogDescription>되돌릴 수 없습니다.</AlertDialogDescription>
						</AlertDialogHeader>
						<DescriptionList>
							<DescriptionItem label="이름">예전 Gemini 키</DescriptionItem>
						</DescriptionList>
						<AlertDialogFooter>
							<AlertDialogCancel>취소</AlertDialogCancel>
							<AlertDialogAction variant="danger">지우기</AlertDialogAction>
						</AlertDialogFooter>
					</AlertDialogContent>
				</AlertDialog>
			);
		case "추가됨":
			return <Said>키를 추가했습니다</Said>;
		case "편집 저장됨":
			return <Said>저장했습니다</Said>;
		case "지움":
			return <Said>키를 지웠습니다</Said>;
		case "키 넣음":
			return <Said>바른 맞춤법에 키를 넣었습니다</Said>;
		case "모델 바뀜":
			return <Said>빠른 작업 모델을 바꿨습니다 · 응답 1.2초</Said>;
		default:
			return null;
	}
}

/**
 * The keys as rows of the shared table, as the templates tab beside this one draws its list, under the column names "키" and "이번 달": the name and
 * the key's end, its use this month, and a ⋯ with "편집" and "지우기".
 */
function KeyTable({ keys, edit, menu }: { keys: readonly Key[]; edit: boolean; menu: boolean }) {
	return (
		<Table container="none" aria-label="AI 키">
			<KeysHead columns={["키", "이번 달"]} />
			<TableBody>
				{keys.map((key, index) => (
					<TableRow key={key.name} twoLine>
						<TableCell truncate>
							<KeyName name={key.name} tail={key.tail} tone={key.tone} />
						</TableCell>
						<TableCell>
							<Text variant="note" tone={key.tone ?? "subtle"}>
								{key.meta}
							</Text>
						</TableCell>
						<TableCell align="end">
							<KeyMenu edit={edit} open={menu && index === 0} />
						</TableCell>
					</TableRow>
				))}
			</TableBody>
		</Table>
	);
}

/** The keys plugins ask for, in the same table: a slot with a key has the same ⋯; one without has "키 넣기". */
function SlotTable({ slots }: { slots: readonly Slot[] }) {
	return (
		<Table container="none" aria-label="플러그인 키">
			<KeysHead columns={["키"]} />
			<TableBody>
				{slots.map((slot) => (
					<TableRow key={slot.id} twoLine>
						<TableCell truncate>
							<KeyName name={slot.title} detail={slot.detail} tail={slot.tail} meta={slot.meta} mono />
						</TableCell>
						<TableCell align="end">
							{slot.tail ? (
								<KeyMenu />
							) : (
								<Button variant="ghost" size="sm">
									키 넣기
								</Button>
							)}
						</TableCell>
					</TableRow>
				))}
			</TableBody>
		</Table>
	);
}

/** The AI keys each stage shows. */
function keysOf(stage: ApiKeysStage): readonly Key[] {
	switch (stage) {
		case "키 없음":
		case "비밀값 없음":
			return [];
		case "추가됨":
			return [...KEYS, { name: "Anthropic 2", tail: "9d3f", meta: "사용 없음", tone: "faint" }];
		case "편집 저장됨":
			return KEYS.map((key, index) => (index === 0 ? { ...key, tail: "7c0e" } : key));
		case "지움":
			return KEYS.slice(0, 2);
		case "읽을 수 없음":
		case "다시 넣기":
		case "비밀값 없음 · 키 있음":
			return KEYS.map((key) => ({ ...key, meta: "읽을 수 없음", tone: "danger" as const }));
		default:
			return KEYS;
	}
}

/**
 * Tools, API keys tab. The AI services' keys are a list like the templates tab's: rows of the shared table under their column names, each with its
 * last four after its name, its use this month in its own column, and "편집 · 지우기" in its ⋯. Under it, the two models this screen picks (the one
 * a new conversation starts with, and the quick tasks'): settings, not a list. A site whose
 * plugins ask for keys has a second list, one row per slot, and then each list has its name over it. All keys go through the same key window (a
 * plugin's has its service set). `stage` draws each state of flow 10; `plugins` off is a site whose plugins ask for no key.
 */
export function ApiKeysScreen({ stage = "기본", plugins = true }: { stage?: ApiKeysStage; plugins?: boolean }) {
	const keys = keysOf(stage);
	const noSecret = stage === "비밀값 없음" || stage === "비밀값 없음 · 키 있음";
	const unreadable = stage === "읽을 수 없음" || stage === "다시 넣기";
	const conversation = {
		value: "a:claude-sonnet-5-5",
		model: "Claude Sonnet 5.5",
		meta: "Anthropic 개인",
		title: "claude-sonnet-5-5",
	};
	const quick =
		stage === "모델 바뀜"
			? {
					value: "o:meta-llama/llama-4-maverick:free",
					model: "Meta: Llama 4 Maverick (free)",
					meta: "OpenRouter",
					title: "meta-llama/llama-4-maverick:free\n입력 한도 1.05M 토큰",
				}
			: { value: "a:claude-haiku-5-5", model: "Claude Haiku 5.5", meta: "Anthropic 개인", title: "claude-haiku-5-5" };
	const slots = SLOTS.map((slot) => (stage === "키 넣음" && slot.id === "bareun" ? { ...slot, tail: "4410" } : slot));
	/** Two lists on the page: each says which it is. One list needs no name, the tab has said it. */
	const named = plugins && !noSecret;
	const list =
		keys.length === 0 ? (
			noSecret ? null : (
				<Empty title="아직 키가 없습니다." />
			)
		) : (
			<KeyTable keys={keys} edit={!noSecret} menu={stage === "줄 메뉴"} />
		);
	return (
		<AdminFrame
			open="tools"
			// A banner about the screen stands at the very top of the page, edge to edge, over its title (screens/common.md).
			banner={
				noSecret ? (
					<Banner title="키를 저장할 수 없습니다" meta="MONTI_SECRET 없음" />
				) : unreadable ? (
					<Banner title="키 3개를 읽을 수 없습니다" meta="MONTI_SECRET 변경" />
				) : undefined
			}
		>
			<PageColumn>
				<PageHeader title="도구">
					{!noSecret && (
						<Button>
							{"+"}
							{" 키 추가"}
						</Button>
					)}
				</PageHeader>
				<PageToolbar inset>
					<TabLinks variant="toolbar">
						<TabLink>템플릿</TabLink>
						<TabLink>데이터</TabLink>
						<TabLink current>API 키</TabLink>
					</TabLinks>
				</PageToolbar>
				<PageBody>
					<Stack gap={40} paddingTop={named ? 32 : 0}>
						{named ? (
							<ListSection table title="AI 키">
								{list}
							</ListSection>
						) : (
							list
						)}
						{/* The two models this screen picks; the lists come from the AI keys above. */}
						{!noSecret && (
							<ListSection title="모델">
								{[
									{
										id: "model-assistant",
										title: "대화",
										meta: "새 대화가 시작하는 모델",
										now: conversation,
										open: false,
									},
									{
										id: "model-quick",
										title: "빠른 작업",
										meta: "채우기 · 요청 · 번역",
										now: quick,
										open: stage === "모델 고르기",
									},
								].map((row) => (
									<ListSectionRow
										key={row.id}
										title={row.title}
										labelId={row.id}
										meta={row.meta}
										control={
											keys.length === 0 || unreadable ? (
												<MenuField aria-labelledby={row.id} size="default" placeholder="키 없음" />
											) : (
												<ModelMenu
													layout="field"
													open={row.open}
													value={row.now.value}
													onValueChange={() => {}}
													groups={MODELS}
													searchLabel="모델 찾기"
													emptyText="맞는 모델이 없습니다"
													trigger={
														<MenuField
															aria-labelledby={row.id}
															size="default"
															value={row.now.model}
															meta={row.now.meta}
														/>
													}
												/>
											)
										}
									/>
								))}
							</ListSection>
						)}
						{/* A plugin's slot is a key row like the AI keys: the same window adds and changes it, with its service already set. */}
						{named && (
							<ListSection table title="플러그인 키">
								<SlotTable slots={slots} />
							</ListSection>
						)}
					</Stack>
				</PageBody>
			</PageColumn>
			<Floating stage={stage} />
		</AdminFrame>
	);
}
