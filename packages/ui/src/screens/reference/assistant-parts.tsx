import { Add, Copy, Edit, RecentlyViewed, Renew } from "../../icons";
import {
	ChatInput,
	ChatMessageActions,
	ChatQueueItem,
	Del,
	IconButton,
	Ins,
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

/** The assistant's panel as the boards draw it: its head (history, new conversation, close), what it holds, and the box to type in. */
export function AssistantPanel({
	placeholder,
	effort,
	newConversation = true,
	queued,
	children,
}: {
	placeholder: string;
	/** How hard the model thinks, after its name ("보통" in "· 생각 보통"). */
	effort?: string;
	/** The + that starts a new conversation (not shown before the first one). */
	newConversation?: boolean;
	/** The assistant is working and these messages wait over the text box. */
	queued?: readonly string[];
	children?: React.ReactNode;
}) {
	return (
		<SidePanel
			title="어시스턴트"
			width="assistant"
			bleed
			closable
			onClose={none}
			actions={
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
			}
			composer={
				<ChatInput
					value=""
					onValueChange={none}
					onSubmit={none}
					onStop={none}
					label="어시스턴트에게 묻기"
					placeholder={placeholder}
					sendLabel="보내기"
					stopLabel="멈추기"
					busy={queued !== undefined}
					busyPlaceholder="더 말하기"
					onQueue={none}
					queue={queued?.map((words) => (
						<ChatQueueItem
							key={words}
							sendNowLabel="지금 보내기"
							editLabel="고치기"
							cancelLabel="취소"
							onSendNow={none}
							onEdit={none}
							onCancel={none}
						>
							{words}
						</ChatQueueItem>
					))}
					aside={
						<ModelMenuButton
							model="claude-sonnet-5-5"
							thinking={effort ? `생각 ${effort}` : undefined}
							label="모델 고르기"
						/>
					}
				/>
			}
		>
			{children}
		</SidePanel>
	);
}

/** The row under a message as the boards draw it: the time, copy, and edit (the admin's) or do again (the assistant's). */
export function MessageActions({
	author,
	time,
	shown,
}: {
	author: "user" | "assistant";
	time: string;
	shown?: boolean;
}) {
	return (
		<ChatMessageActions author={author} time={time} shown={shown}>
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
