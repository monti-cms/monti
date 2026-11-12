import { Add, Copy, Edit, RecentlyViewed, Renew } from "../../icons";
import {
	ChatInput,
	ChatMessageActions,
	ChatQueueItem,
	Del,
	IconButton,
	Ins,
	ModelMenu,
	ModelMenuButton,
	SidePanel,
} from "../../index";

const none = () => {};

/** A run of words with what a change takes out (`del`) and puts in (`ins`). */
export type Marked = readonly (string | readonly ["del" | "ins", string])[];

/** Draws a marked run with the design system's change marks. */
export function marked(run: Marked) {
	return run.map((piece, index) =>
		typeof piece === "string" ? (
			piece
		) : piece[0] === "del" ? (
			<Del key={index}>{piece[1]}</Del>
		) : (
			<Ins key={index}>{piece[1]}</Ins>
		),
	);
}

/** The models of the reference site's keys, as the model menu groups them: the recent ones, then one group per key. */
const MODEL_GROUPS = [
	{
		key: "recent",
		label: "최근",
		items: [
			{ value: "a:claude-sonnet-5-5", model: "claude-sonnet-5-5", hint: "Anthropic 개인" },
			{ value: "r:openai/gpt-5", model: "openai/gpt-5", hint: "OpenRouter" },
		],
	},
	{
		key: "anthropic",
		label: "Anthropic 개인",
		count: 3,
		items: [
			{ value: "a:claude-opus-5-5", model: "claude-opus-5-5" },
			{ value: "a:claude-sonnet-5-5", model: "claude-sonnet-5-5", hint: "기본" },
			{ value: "a:claude-haiku-5-5", model: "claude-haiku-5-5" },
		],
	},
	{
		key: "openrouter",
		label: "OpenRouter",
		count: 214,
		items: [
			{ value: "r:openai/gpt-5", model: "openai/gpt-5" },
			{ value: "r:google/gemini-3-pro", model: "google/gemini-3-pro" },
			{ value: "r:meta-llama/llama-4-70b", model: "meta-llama/llama-4-70b" },
		],
	},
];

const THINKING_LEVELS = [
	{ value: "off", label: "끔" },
	{ value: "low", label: "낮음" },
	{ value: "medium", label: "보통" },
	{ value: "high", label: "높음" },
];

/** One message waiting over the text box while the assistant works. */
function Queued({ words }: { words: string }) {
	return (
		<ChatQueueItem
			sendNowLabel="지금 보내기"
			editLabel="고치기"
			cancelLabel="취소"
			onSendNow={none}
			onEdit={none}
			onCancel={none}
		>
			{words}
		</ChatQueueItem>
	);
}

/**
 * The assistant's panel as the boards draw it: its head (history, new conversation, close), what it holds, and the box to type in. `history` is the
 * view of the past conversations: a back button, no box to type in, and a foot.
 */
export function AssistantPanel({
	placeholder,
	model = "claude-sonnet-5-5",
	effort,
	newConversation = true,
	queued,
	busy = queued !== undefined,
	value = "",
	context,
	menu,
	composer = true,
	history,
	children,
}: {
	placeholder?: string;
	/** The conversation's model, as its button names it. */
	model?: string;
	/** How hard the model thinks, after its name ("보통" in "· 생각 보통"). Left out for a model that cannot think. */
	effort?: string;
	/** The + that starts a new conversation (not shown before the first one). */
	newConversation?: boolean;
	/** The assistant is working and these messages wait over the text box. */
	queued?: readonly string[];
	/** The assistant is working: the send button is the stop button. */
	busy?: boolean;
	/** What is typed in the box. */
	value?: string;
	/** The chips over the text: what goes with the message ("이 글", "고른 글 2편"). */
	context?: React.ReactNode;
	/** The model menu is open. */
	menu?: boolean;
	/** No box to type in (no key yet). */
	composer?: boolean;
	/** The past conversations: the head's back button and title, and the panel's foot. */
	history?: { footer: React.ReactNode };
	children?: React.ReactNode;
}) {
	const button = <ModelMenuButton model={model} thinking={effort ? `생각 ${effort}` : undefined} label="모델 고르기" />;
	return (
		<SidePanel
			title={history ? "지난 대화" : "어시스턴트"}
			width="assistant"
			bleed
			closable
			onClose={none}
			{...(history ? { back: { label: "대화로 돌아가기", onClick: none }, footer: history.footer } : {})}
			actions={
				history ? undefined : (
					<>
						<IconButton label="지난 대화">
							<RecentlyViewed />
						</IconButton>
						{newConversation ? (
							<IconButton label="새 대화">
								<Add />
							</IconButton>
						) : null}
					</>
				)
			}
			composer={
				history || !composer ? undefined : (
					<ChatInput
						value={value}
						onValueChange={none}
						onSubmit={none}
						onStop={none}
						label="어시스턴트에게 묻기"
						placeholder={placeholder}
						sendLabel="보내기"
						stopLabel="멈추기"
						busy={busy}
						busyPlaceholder="더 말하기"
						onQueue={none}
						context={context}
						queue={queued?.map((words) => <Queued key={words} words={words} />)}
						aside={
							menu === undefined ? (
								button
							) : (
								<ModelMenu
									trigger={button}
									open={menu}
									value={model === "claude-sonnet-5-5" ? "a:claude-sonnet-5-5" : `r:${model}`}
									onValueChange={none}
									groups={MODEL_GROUPS}
									searchLabel="모델 찾기"
									emptyText="맞는 모델이 없습니다"
									thinking={
										effort
											? {
													label: "생각",
													value: THINKING_LEVELS.find((level) => level.label === effort)?.value ?? "medium",
													options: THINKING_LEVELS,
													onValueChange: none,
												}
											: undefined
									}
								/>
							)
						}
					/>
				)
			}
		>
			{children}
		</SidePanel>
	);
}

/** The row under a message as the boards draw it: the time, copy, and edit (the admin's) or do again (the assistant's). */
export function MessageActions({ author, time }: { author: "user" | "assistant"; time: string }) {
	return (
		<ChatMessageActions author={author} time={time}>
			<IconButton label="복사">
				<Copy />
			</IconButton>
			{author === "user" ? (
				<IconButton label="고쳐서 다시 보내기">
					<Edit />
				</IconButton>
			) : (
				<IconButton label="다시 하기">
					<Renew />
				</IconButton>
			)}
		</ChatMessageActions>
	);
}
