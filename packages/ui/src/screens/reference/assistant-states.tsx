import {
	Box,
	Button,
	ChatAnswer,
	ChatDate,
	ChatEntryLink,
	ChatEntryList,
	ChatMessage,
	ChatThread,
	Chip,
	ConversationGroupLabel,
	ConversationList,
	ConversationRow,
	ConversationRowMore,
	Del,
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
	Empty,
	EmptyStep,
	ErrorNote,
	FilterButton,
	Inline,
	Ins,
	ProposalActions,
	ProposalCard,
	ProposalItem,
	ProposalResult,
	ProposalRow,
	Stack,
	Text,
	TextButton,
	ToolCallLine,
	ToolCallLines,
} from "../../index";
import { AssistantPanel, MessageActions } from "./assistant-parts";

const none = () => {};

/** The states of the assistant's panel that the flows name (flow 2) and the ones the run engine adds (stopped, a limit, no answer). */
export type AssistantView =
	| "asking"
	| "writing"
	| "filtered"
	| "opened"
	| "blocked"
	| "dropped"
	| "limit"
	| "stopped"
	| "noAnswer"
	| "refused"
	| "toolFailed"
	| "toolOpen"
	| "requestInEntry"
	| "delegate"
	| "card"
	| "cardApplying"
	| "applied"
	| "reverted"
	| "discarded"
	| "altText"
	| "settings"
	| "onEntry"
	| "noKey"
	| "models"
	| "thinkingHigh"
	| "noThinking"
	| "history"
	| "historyEmpty"
	| "reopened";

const Done = ({ children, details }: { children: React.ReactNode; details?: { label: string; value: string }[] }) => (
	<ToolCallLine status="done" statusLabel="끝남" details={details} defaultOpen={details !== undefined}>
		{children}
	</ToolCallLine>
);

/** The first exchange of flow 2: asked for the posts without a summary, answered with the two. */
const found = (
	<>
		<ChatMessage author="user">요약이 비어 있는 글 찾아 줘</ChatMessage>
		<MessageActions author="user" time="오후 3:12" />
		<ChatAnswer>
			<ToolCallLines>
				<Done>글 목록 읽음 · 148편</Done>
				<Done>글 읽음 · 148편</Done>
				<Done>목록 거름 · 요약 비어 있음</Done>
			</ToolCallLines>
			<ChatMessage author="assistant">요약이 빈 글은 두 편이에요. 목록을 그 두 편으로 걸러 두었어요.</ChatMessage>
			<ChatEntryList>
				<ChatEntryLink slug="/edited-post">발행 후 고친 글</ChatEntryLink>
				<ChatEntryLink slug="/draft-post">쓰는 중인 글</ChatEntryLink>
			</ChatEntryList>
		</ChatAnswer>
		<MessageActions author="assistant" time="오후 3:12" />
	</>
);

const opened = (
	<>
		<ChatMessage author="user">첫 번째 글 열어 줘</ChatMessage>
		<MessageActions author="user" time="오후 3:13" />
		<ChatAnswer>
			<ToolCallLines>
				<Done>화면 이동 · 첫 번째 글</Done>
			</ToolCallLines>
			<ChatMessage author="assistant">첫 번째 글을 열었어요.</ChatMessage>
		</ChatAnswer>
		<MessageActions author="assistant" time="오후 3:13" />
	</>
);

const bigRequest = (
	<>
		<ChatMessage author="user" context="고른 글 2편">
			이 두 편 요약 채워 줘. 작년 글은 2024 폴더로 옮기고, ‘발행 후 고친 글’은 더 짧게 다듬어 줘. 쓰지 않는 이미지도
			지워 줘.
		</ChatMessage>
		<MessageActions author="user" time="오전 10:51" />
	</>
);

const bigLines = (
	<ToolCallLines>
		<Done>글 읽음 · 14편</Done>
		<Done>파일 목록 읽음 · 212개</Done>
		<Done>다듬기 · 3곳</Done>
		<Done>요약 채우기 · 2편</Done>
		<Done>2024 폴더로 옮기기 · 11편</Done>
		<Done>휴지통으로 보내기 · 3개</Done>
	</ToolCallLines>
);

const groups = (
	<>
		<ProposalRow name="다듬기" detail="발행 후 고친 글" count="3곳" />
		<ProposalRow name="요약 채우기" count="글 2편" />
		<ProposalRow name="2024 폴더로 옮기기" count="글 11편" />
		<ProposalRow name="휴지통으로 보내기" count="파일 3개" />
	</>
);

/** The ⋯ of a past conversation. */
const More = () => (
	<DropdownMenu>
		<DropdownMenuTrigger render={<ConversationRowMore aria-label="대화 메뉴" />} />
		<DropdownMenuContent align="end">
			<DropdownMenuItem variant="danger">지우기</DropdownMenuItem>
		</DropdownMenuContent>
	</DropdownMenu>
);

/** The foot of the past conversations: how long one that is not opened is kept. */
const keep = (
	<Inline gap={8} justify="between" grow>
		<Text variant="note" tone="subtle">
			안 연 대화 지우기
		</Text>
		<FilterButton filled>30일 뒤</FilterButton>
	</Inline>
);

/** The panel in one of its states. */
export function panelOf(view: AssistantView) {
	const site = "사이트에 대해 물어보세요";
	const entry = "이 글에 대해 물어보세요";
	switch (view) {
		case "asking":
			return (
				<AssistantPanel placeholder={site} effort="보통" busy>
					<ChatThread>
						<ChatMessage author="user">요약이 비어 있는 글 찾아 줘</ChatMessage>
						<MessageActions author="user" time="오후 3:12" />
						<ChatAnswer>
							<ToolCallLines>
								<Done>글 목록 읽음 · 148편</Done>
								<ToolCallLine status="running" statusLabel="하는 중">
									글 읽는 중 · 62 / 148
								</ToolCallLine>
							</ToolCallLines>
						</ChatAnswer>
					</ChatThread>
				</AssistantPanel>
			);
		case "writing":
			return (
				<AssistantPanel placeholder={site} effort="보통" busy>
					<ChatThread>
						<ChatMessage author="user">요약이 비어 있는 글 찾아 줘</ChatMessage>
						<MessageActions author="user" time="오후 3:12" />
						<ChatAnswer>
							<ToolCallLines>
								<Done>글 목록 읽음 · 148편</Done>
								<Done>글 읽음 · 148편</Done>
							</ToolCallLines>
							<ChatMessage author="assistant" streaming>
								요약이 빈 글은 두 편이에요. 목록을
							</ChatMessage>
						</ChatAnswer>
					</ChatThread>
				</AssistantPanel>
			);
		case "filtered":
			return (
				<AssistantPanel placeholder={site} effort="보통">
					<ChatThread>{found}</ChatThread>
				</AssistantPanel>
			);
		case "opened":
			return (
				<AssistantPanel placeholder={entry} effort="보통">
					<ChatThread>
						{found}
						{opened}
					</ChatThread>
				</AssistantPanel>
			);
		case "blocked":
			return (
				<AssistantPanel placeholder={entry} effort="보통">
					<ChatThread>
						{opened}
						<ChatMessage author="user">가을 사진 정리 글 열어 줘</ChatMessage>
						<MessageActions author="user" time="오후 3:20" />
						<ChatAnswer>
							<ChatMessage author="assistant">저장 전 변경이 있어 옮기지 않았어요.</ChatMessage>
							<Stack gap={8} align="start">
								<Inline gap={8} align="baseline">
									<TextButton variant="underline">가을 사진 정리</TextButton>
									<Text mono variant="meta" tone="subtle">
										/autumn-photos
									</Text>
								</Inline>
								<Button variant="secondary" size="sm">
									저장하고 열기
								</Button>
							</Stack>
						</ChatAnswer>
						<MessageActions author="assistant" time="오후 3:20" />
					</ChatThread>
				</AssistantPanel>
			);
		case "dropped":
		case "limit":
			return (
				<AssistantPanel placeholder={site} effort="보통">
					<ChatThread>
						<ChatMessage author="user">요약이 비어 있는 글 찾아 줘</ChatMessage>
						<MessageActions author="user" time="오후 3:12" />
						<ChatAnswer>
							<ToolCallLines>
								<Done>글 목록 읽음 · 148편</Done>
								{view === "dropped" ? (
									<ToolCallLine status="failed" statusLabel="멈춤">
										글 읽기 · 62 / 148에서 멈춤
									</ToolCallLine>
								) : (
									<Done>글 읽음 · 148편</Done>
								)}
							</ToolCallLines>
							<ErrorNote
								title={view === "dropped" ? "연결이 끊겼습니다" : "한도에 닿아 멈췄습니다"}
								actions={<TextButton variant="underline">이어서 하기</TextButton>}
							/>
						</ChatAnswer>
					</ChatThread>
				</AssistantPanel>
			);
		case "stopped":
			return (
				<AssistantPanel placeholder={site} effort="보통">
					<ChatThread>
						<ChatMessage author="user">작년 글을 모두 영어로 옮겨 줘</ChatMessage>
						<MessageActions author="user" time="오후 4:02" />
						<ChatAnswer>
							<ToolCallLines>
								<Done>글 목록 읽음 · 2025년 글 12편</Done>
								<Done>번역 · 3편</Done>
							</ToolCallLines>
							<ProposalCard
								title="제안"
								summary="1묶음 · 3건"
								status="검토 대기"
								statusTone="warning"
								footer={
									<ProposalActions
										reviewLabel="검토"
										onReview={none}
										discardLabel="버리기"
										onDiscard={none}
										applyLabel="3편 적용"
										onApply={none}
									/>
								}
							>
								<ProposalRow name="번역 · English" count="새 글 3편" />
							</ProposalCard>
						</ChatAnswer>
						<MessageActions author="assistant" time="오후 4:03" />
					</ChatThread>
				</AssistantPanel>
			);
		case "noAnswer":
			return (
				<AssistantPanel placeholder={site} effort="보통">
					<ChatThread>
						<ChatMessage author="user">요약이 비어 있는 글 찾아 줘</ChatMessage>
						<MessageActions author="user" time="오후 3:12" />
						<ChatAnswer>
							<ErrorNote
								title="Anthropic이 답하지 않습니다"
								actions={<TextButton variant="underline">다시 시도</TextButton>}
							>
								Anthropic 개인
							</ErrorNote>
						</ChatAnswer>
					</ChatThread>
				</AssistantPanel>
			);
		case "refused":
			return (
				<AssistantPanel placeholder={site} effort="보통">
					<ChatThread>
						<ChatMessage author="user">요약이 비어 있는 글 찾아 줘</ChatMessage>
						<MessageActions author="user" time="오후 3:12" />
						<ChatAnswer>
							<ErrorNote
								title="Anthropic이 거절했습니다"
								actions={<TextButton variant="underline">다른 모델로 보내기</TextButton>}
							>
								Anthropic 개인 · Your credit balance is too low to access the Anthropic API.
							</ErrorNote>
						</ChatAnswer>
					</ChatThread>
				</AssistantPanel>
			);
		case "toolFailed":
			return (
				<AssistantPanel placeholder={site} effort="보통">
					<ChatThread>
						<ChatMessage author="user">‘겨울 사진’ 글을 2024 폴더로 옮겨 줘</ChatMessage>
						<MessageActions author="user" time="오후 3:30" />
						<ChatAnswer>
							<ToolCallLines>
								<Done>글 목록 읽음 · 1편</Done>
								<ToolCallLine status="failed" statusLabel="못 함">
									폴더로 옮기기
								</ToolCallLine>
							</ToolCallLines>
							<ChatMessage author="assistant">
								‘겨울 사진’은 휴지통에 있어서 옮길 수 없어요. 먼저 복원할까요?
							</ChatMessage>
						</ChatAnswer>
						<MessageActions author="assistant" time="오후 3:30" />
					</ChatThread>
				</AssistantPanel>
			);
		case "toolOpen":
			return (
				<AssistantPanel placeholder={site} effort="보통">
					<ChatThread>
						<ChatMessage author="user">요약이 비어 있는 글 찾아 줘</ChatMessage>
						<MessageActions author="user" time="오후 3:12" />
						<ChatAnswer>
							<ToolCallLines>
								<Done
									details={[
										{
											label: "보낸 값",
											value:
												'{\n  "collection": "posts",\n  "where": { "summary": { "empty": true } },\n  "limit": 200\n}',
										},
									]}
								>
									글 목록 읽음 · 148편
								</Done>
								<Done>글 읽음 · 148편</Done>
							</ToolCallLines>
							<ChatMessage author="assistant">요약이 빈 글은 두 편이에요.</ChatMessage>
						</ChatAnswer>
						<MessageActions author="assistant" time="오후 3:12" />
					</ChatThread>
				</AssistantPanel>
			);
		case "requestInEntry":
			return (
				<AssistantPanel placeholder={entry} effort="보통" value="더 짧게 다듬어 줘. 말투는 그대로.">
					<ChatThread>
						{found}
						{opened}
					</ChatThread>
				</AssistantPanel>
			);
		case "delegate":
			return (
				<AssistantPanel
					placeholder={site}
					effort="보통"
					value="이 두 편 요약 채워 줘. 작년 글은 2024 폴더로 옮기고, ‘발행 후 고친 글’은 더 짧게 다듬어 줘. 쓰지 않는 이미지도 지워 줘."
					context={
						<Chip size="sm" onRemove={none}>
							고른 글 2편
						</Chip>
					}
				>
					<ChatThread>
						{found}
						<ChatMessage author="user">둘 다 골라 줘</ChatMessage>
						<MessageActions author="user" time="오전 10:50" />
						<ChatAnswer>
							<ToolCallLines>
								<Done>목록에서 고름 · 2편</Done>
							</ToolCallLines>
							<ChatMessage author="assistant">두 편을 골라 두었어요.</ChatMessage>
						</ChatAnswer>
						<MessageActions author="assistant" time="오전 10:50" />
					</ChatThread>
				</AssistantPanel>
			);
		case "card":
		case "cardApplying":
			return (
				<AssistantPanel placeholder={site} effort="보통">
					<ChatThread>
						{bigRequest}
						<ChatAnswer>
							{bigLines}
							<ProposalCard
								title="제안"
								summary="4묶음 · 19건"
								status={view === "card" ? "검토 대기" : "적용 중 9 / 17"}
								statusTone="warning"
								footer={
									<ProposalActions
										reviewLabel="검토"
										onReview={none}
										discardLabel="버리기"
										onDiscard={none}
										applyLabel={view === "card" ? "19건 적용" : "17건 적용"}
										onApply={none}
										busy={view === "cardApplying"}
									/>
								}
							>
								{groups}
							</ProposalCard>
						</ChatAnswer>
						<MessageActions author="assistant" time="오전 10:51" />
					</ChatThread>
				</AssistantPanel>
			);
		case "applied":
			return (
				<AssistantPanel placeholder={site} effort="보통">
					<ChatThread>
						{bigRequest}
						<ChatAnswer>
							{bigLines}
							<ProposalCard
								title="제안"
								summary="4묶음 · 17건"
								status="적용됨"
								statusTone="success"
								footer={
									<ProposalResult
										appliedLabel="✓ 16건 적용"
										failedLabel="1건 못 함"
										time="10:52"
										undoLabel="모두 되돌리기"
										onUndo={none}
									/>
								}
								after={<ProposalRow name="못 옮김" detail="겨울 사진 · 휴지통에 있음" tone="danger" />}
							>
								{groups}
							</ProposalCard>
						</ChatAnswer>
						<MessageActions author="assistant" time="오전 10:51" />
					</ChatThread>
				</AssistantPanel>
			);
		case "reverted":
		case "discarded":
			return (
				<AssistantPanel placeholder={site} effort="보통">
					<ChatThread>
						{bigRequest}
						<ChatAnswer>
							{bigLines}
							<ProposalCard
								title="제안"
								summary="4묶음 · 19건"
								status={view === "reverted" ? "되돌림 · 10:58" : "버림"}
								statusTone="subtle"
								muted={view === "discarded"}
							>
								{groups}
							</ProposalCard>
						</ChatAnswer>
						<MessageActions author="assistant" time="오전 10:51" />
					</ChatThread>
				</AssistantPanel>
			);
		case "altText":
			return (
				<AssistantPanel placeholder={site} effort="보통">
					<ChatThread>
						<ChatMessage author="user" request>
							대체 텍스트 없는 이미지 채워 줘
						</ChatMessage>
						<MessageActions author="user" time="오후 2:40" />
						<ChatAnswer>
							<ToolCallLines>
								<Done>글 목록 읽음 · 148편</Done>
								<Done>글 읽음 · 4편</Done>
								<Done>이미지 봄 · 5장</Done>
								<Done>대체 텍스트 채우기 · 5곳</Done>
							</ToolCallLines>
							<ProposalCard
								title="제안"
								summary="대체 텍스트 · 5곳"
								status="검토 대기"
								statusTone="warning"
								footer={
									<ProposalActions
										reviewLabel="검토"
										onReview={none}
										discardLabel="버리기"
										onDiscard={none}
										applyLabel="5곳 적용"
										onApply={none}
									/>
								}
							>
								<ProposalItem title="autumn-trail.jpg">
									<Ins>단풍이 든 산길을 걷는 두 사람</Ins>
								</ProposalItem>
								<ProposalItem title="harbor-night.png">
									<Ins>불이 켜진 밤 항구와 정박한 배들</Ins>
								</ProposalItem>
								<ProposalItem title="desk-setup.webp">
									<Ins>노트북과 커피잔이 놓인 나무 책상</Ins>
								</ProposalItem>
								<ProposalRow detail="외 2곳" />
							</ProposalCard>
						</ChatAnswer>
						<MessageActions author="assistant" time="오후 2:41" />
					</ChatThread>
				</AssistantPanel>
			);
		case "settings":
			return (
				<AssistantPanel placeholder="설정에 대해 물어보세요" effort="보통">
					<ChatThread>
						<ChatMessage author="user">미리보기 주소는 draft로, 기본 언어는 주소에서 빼 줘</ChatMessage>
						<MessageActions author="user" time="오전 11:20" />
						<ChatAnswer>
							<ToolCallLines>
								<Done>설정 읽음</Done>
								<Done>설정 바꾸기 · 2곳</Done>
							</ToolCallLines>
							<ChatMessage author="assistant">설정 두 곳에 표시해 두었어요. 저장하면 적용돼요.</ChatMessage>
						</ChatAnswer>
						<MessageActions author="assistant" time="오전 11:20" />
					</ChatThread>
				</AssistantPanel>
			);
		case "onEntry":
			return (
				<AssistantPanel placeholder={entry} effort="보통">
					<ChatThread>
						<ChatMessage author="user">더 짧게 다듬어 줘. 말투는 그대로.</ChatMessage>
						<MessageActions author="user" time="오전 10:57" />
						<ChatAnswer>
							<ToolCallLines>
								<Done>글 읽음 · 첫 번째 글</Done>
								<Done>더 짧게 다듬기 · 5곳</Done>
							</ToolCallLines>
							<ChatMessage author="assistant">다섯 곳을 줄였어요. 글에서 하나씩 보고 받아 주세요.</ChatMessage>
						</ChatAnswer>
						<MessageActions author="assistant" time="오전 10:57" />
					</ChatThread>
				</AssistantPanel>
			);
		case "noKey":
			return (
				<AssistantPanel composer={false} newConversation={false}>
					<Box paddingX={24}>
						<Empty title="AI 연결이 없습니다">
							<EmptyStep>API 키 넣기</EmptyStep>
						</Empty>
					</Box>
				</AssistantPanel>
			);
		case "models":
			return <AssistantPanel placeholder={site} effort="보통" newConversation={false} menu />;
		case "thinkingHigh":
			return <AssistantPanel placeholder={site} effort="높음" newConversation={false} />;
		case "noThinking":
			return <AssistantPanel placeholder={site} model="meta-llama/llama-4-70b" newConversation={false} menu />;
		case "history":
			return (
				<AssistantPanel history={{ footer: keep }}>
					<ConversationList>
						<ConversationGroupLabel>오늘</ConversationGroupLabel>
						<ConversationRow title="요약이 비어 있는 글 찾아 줘" meta="10:52 · 적용 16건" current menu={<More />} />
						<ConversationRow title="더 짧게 다듬어 줘. 말투는 그대로." meta="10:57 · 받음 5곳" menu={<More />} />
						<ConversationRow title="대체 텍스트 없는 이미지 채워 줘" meta="09:12 · 검토 대기" menu={<More />} />
						<ConversationGroupLabel>이전</ConversationGroupLabel>
						<ConversationRow title="안 쓰는 태그 정리해 줘" meta="10. 24 · 검토 대기" menu={<More />} />
						<ConversationRow title="작년 글은 2024 폴더로 옮겨 줘" meta="10. 22 · 되돌림" menu={<More />} />
						<ConversationRow
							title="발행 후 고친 글의 문장을 다듬고 맞춤법과 띄어쓰기를 바로잡아 줘"
							meta="10. 21 · 버림"
							menu={<More />}
						/>
						<ConversationRow title="이 사이트에 글이 몇 편 있어?" meta="10. 20" menu={<More />} />
					</ConversationList>
				</AssistantPanel>
			);
		case "historyEmpty":
			return (
				<AssistantPanel history={{ footer: keep }}>
					<Stack padding={24}>
						<Text variant="note" tone="subtle">
							지난 대화가 없습니다
						</Text>
					</Stack>
				</AssistantPanel>
			);
		case "reopened":
			return (
				<AssistantPanel placeholder={site} model="claude-opus-5-5" effort="높음">
					<ChatThread>
						<ChatDate>10. 24 (금)</ChatDate>
						<ChatMessage author="user">안 쓰는 태그 정리해 줘</ChatMessage>
						<MessageActions author="user" time="오후 5:31" />
						<ChatAnswer>
							<ToolCallLines>
								<Done>태그 목록 읽음 · 31개</Done>
								<Done>태그 지우기 · 4개</Done>
							</ToolCallLines>
							<ProposalCard
								title="제안"
								summary="태그 지우기 · 4개"
								status="검토 대기"
								statusTone="warning"
								footer={
									<ProposalActions
										reviewLabel="검토"
										onReview={none}
										discardLabel="버리기"
										onDiscard={none}
										applyLabel="4개 적용"
										onApply={none}
									/>
								}
							>
								<ProposalRow detail={<Del>webpack · 회고-2022 · 임시 · test</Del>} count="글 0편" />
							</ProposalCard>
						</ChatAnswer>
						<MessageActions author="assistant" time="오후 5:31" />
					</ChatThread>
				</AssistantPanel>
			);
	}
}

/** The assistant's panel alone, in one of its states, at the right edge where the frame docks it. The page beside it is that page's own reference. */
export function AssistantStateScreen({ view }: { view: AssistantView }) {
	return (
		<Inline align="stretch" justify="end" gap={0} height="screen">
			{panelOf(view)}
		</Inline>
	);
}
