import { useRef } from "react";
import { Renew, Settings, Spark } from "../../icons";
import {
	Box,
	FloatingBar,
	FloatingBarButton,
	FormField,
	FormFieldError,
	FormFieldLabel,
	Image,
	Inline,
	Input,
	Marker,
	MemoCardPopover,
	MemoDiff,
	Option,
	Popover,
	PopoverContent,
	PopoverTrigger,
	ProposalBubble,
	ProposalBubbleDock,
	RequestAnchor,
	Stack,
	StatusBar,
	StatusBarCell,
	StatusBarSpacer,
	Switch,
	Text,
	Textarea,
	TextButton,
} from "../../index";
import {
	BodyBlock,
	BodyHeading,
	EditorPage,
	EntryHeader,
	EntryProperties,
	EntryTitle,
	LanguageTabs,
	Paragraph,
	still,
} from "./editor-notion";

/**
 * The assistant's pieces in the editor that the proposals screen does not draw: a field being filled, filled, and not filled (the service said
 * no); a request about picked words, just opened; and a proposal the text has moved away from.
 */
export type EditorAssistState = "filling" | "filled" | "fillFailed" | "request" | "stale" | "image";

/** The summary field with its ✦ button in one of its states. */
function Summary({ state }: { state: EditorAssistState }) {
	const filled = state === "filled";
	return (
		<FormField>
			<FormFieldLabel
				htmlFor="ref-summary"
				action={
					<TextButton tone="proposal" size="micro" loading={state === "filling"}>
						{state === "filling" ? null : filled ? <Renew aria-hidden /> : <Spark aria-hidden />}
						{state === "filling" ? "쓰는 중…" : filled ? "다시" : "채우기"}
					</TextButton>
				}
			>
				요약
			</FormFieldLabel>
			<Textarea
				size="md"
				id="ref-summary"
				placeholder="비어 있음"
				defaultValue={filled ? "리액트로 블로그를 다시 만들며 덜어낸 것과 남긴 것." : undefined}
				proposal={filled}
				aria-invalid={state === "fillFailed" || undefined}
			/>
			{state === "fillFailed" ? <FormFieldError>Anthropic이 거절했습니다 · Anthropic 개인</FormFieldError> : null}
		</FormField>
	);
}

export function EditorAssistScreen({ state }: { state: EditorAssistState }) {
	const picked = useRef<HTMLDivElement>(null);
	const moved = useRef<HTMLDivElement>(null);
	const bar = useRef<HTMLDivElement>(null);
	const body = state === "request" || state === "stale" || state === "image";
	return (
		<EditorPage
			header={<EntryHeader address="/posts/first-post" status="editing" statusLabel="수정 중" />}
			head={<LanguageTabs englishDot />}
			side={<EntryProperties summary={<Summary state={body ? "filled" : state} />} />}
			statusBar={
				<StatusBar>
					<StatusBarCell tone="warning">저장 전 변경사항</StatusBarCell>
					<StatusBarSpacer />
					<StatusBarCell end>1,240자</StatusBarCell>
				</StatusBar>
			}
			dock={
				state === "stale" ? (
					<ProposalBubbleDock>
						<ProposalBubble
							name="더 짧게 다듬기"
							position={2}
							total={2}
							previousLabel="이전 제안"
							nextLabel="다음 제안"
							onPrevious={still}
							onNext={still}
							discardAllLabel="모두 버리기"
							onDiscardAll={still}
							acceptAllLabel="모두 받기"
							onAcceptAll={still}
						/>
					</ProposalBubbleDock>
				) : undefined
			}
		>
			<EntryTitle>첫 번째 글</EntryTitle>
			<Paragraph>블로그를 다시 만들기로 한 건 글을 쓰는 시간보다 도구를 고치는 시간이 길어졌기 때문이다.</Paragraph>
			{state === "image" ? null : (
				<>
					<BodyBlock gap={32}>
						<BodyHeading>무엇을 덜어냈나</BodyHeading>
					</BodyBlock>
					<BodyBlock gap={12}>
						<Box position="relative" ref={picked}>
							<Paragraph>
								목록에는 제목과 주소, 지금 상태만 남겼다.{" "}
								{state === "request" ? (
									<RequestAnchor>나머지는 필요할 때 꺼내 본다.</RequestAnchor>
								) : (
									"나머지는 필요할 때 꺼내 본다."
								)}
							</Paragraph>
						</Box>
					</BodyBlock>
					{state === "request" ? (
						<MemoCardPopover
							anchor={() => picked.current}
							open
							onOpenChange={still}
							reply={{
								placeholder: "어시스턴트에게 요청",
								value: "",
								onValueChange: still,
								onSend: still,
								sendLabel: "요청",
								focus: true,
							}}
						/>
					) : null}
					<BodyBlock gap={20}>
						<Box position="relative" ref={moved}>
							{state === "stale" ? (
								<Marker margin active onClick={still}>
									1
								</Marker>
							) : null}
							<Paragraph>편집기도 같은 원칙으로 정리했다. 글을 쓰는 동안 보이는 건 글과 지금 상태뿐이다.</Paragraph>
						</Box>
					</BodyBlock>
					{state === "stale" ? (
						<MemoCardPopover
							anchor={() => moved.current}
							open
							onOpenChange={still}
							where="이 사이에 고쳐짐"
							discardLabel="버리기"
							onDiscard={still}
							acceptLabel="다시 만들기"
							onAccept={still}
							acceptSpark
						>
							<MemoDiff
								beforeLabel="그때"
								afterLabel="제안"
								before="편집기도 같은 원칙으로 정리했다. 글을 쓰는 동안 보이는 건 글뿐이다."
								after="편집기도 같다. 쓰는 동안 보이는 건 글뿐이다."
							/>
						</MemoCardPopover>
					) : null}
				</>
			)}
			{state === "image" ? (
				<BodyBlock gap={20}>
					<Stack gap={8}>
						{/* The picture's tool row with its settings card open: the words for the picture, with the ✦ on their label row before the count. */}
						<Inline>
							<FloatingBar ref={bar}>
								<Popover open onOpenChange={still}>
									<FloatingBarButton label="설정" pressed trigger={(button) => <PopoverTrigger render={button} />}>
										<Settings aria-hidden />
									</FloatingBarButton>
									<PopoverContent anchor={bar} align="start">
										<Stack gap={12}>
											<FormField>
												<FormFieldLabel
													htmlFor="ref-alt"
													action={
														<Inline gap={8} align="baseline">
															<TextButton tone="proposal" size="micro">
																<Spark aria-hidden />
																채우기
															</TextButton>
															<Text variant="micro" tone="subtle">
																0 / 80
															</Text>
														</Inline>
													}
												>
													대체 텍스트
												</FormFieldLabel>
												<Input id="ref-alt" size="md" />
											</FormField>
											<Option spread>
												장식 이미지
												<Switch checked={false} onCheckedChange={still} />
											</Option>
										</Stack>
									</PopoverContent>
								</Popover>
							</FloatingBar>
						</Inline>
						<Image src={null} alt="" ratio="share" />
						{/* The caption line under the picture: its ✦ at the line's end while the line is empty and the caret is in it. */}
						<Inline gap={8} minHeight="control-sm">
							<Box grow minWidth={0}>
								<Input appearance="inline" size="sm" align="center" aria-label="캡션" placeholder="캡션" />
							</Box>
							<TextButton tone="proposal" size="micro">
								<Spark aria-hidden />
								채우기
							</TextButton>
						</Inline>
					</Stack>
				</BodyBlock>
			) : null}
			<BodyBlock gap={20}>
				<Paragraph tone="faint">/ 를 눌러 블록 넣기</Paragraph>
			</BodyBlock>
		</EditorPage>
	);
}
