import { Add, RecentlyViewed } from "../../icons";
import { ChatInput, Del, IconButton, Ins, ModelMenuButton, SidePanel } from "../../index";

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
	children,
}: {
	placeholder: string;
	/** How hard the model thinks, after its name ("보통" in "· 생각 보통"). */
	effort?: string;
	/** The + that starts a new conversation (not shown before the first one). */
	newConversation?: boolean;
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
