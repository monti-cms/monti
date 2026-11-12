import { ChevronLeft } from "../../icons";
import {
	Button,
	Caret,
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
	Count,
	Fill,
	Inline,
	Marker,
	PageBody,
	PageColumn,
	PageHeader,
	ReviewCompare,
	ReviewCompareHead,
	ReviewGroup,
	ReviewItem,
	ReviewMore,
	ReviewQuote,
	Stack,
	TextButton,
} from "../../index";
import { AdminFrame } from "./frame";

const none = () => {};

/** The blocks of the first post, source beside translation. A block that stays in the source language says so by its name. */
const blocks: readonly { label: string; keep?: boolean; source: string; translation: string }[] = [
	{ label: "제목", source: "첫 번째 글", translation: "The first post" },
	{
		label: "문단 1",
		source: "블로그를 다시 만들기로 한 건 글을 쓰는 시간보다 도구를 고치는 시간이 길어졌기 때문이다.",
		translation: "I rebuilt this blog because I was spending more time fixing my tools than writing.",
	},
	{ label: "제목 2", source: "무엇을 덜어냈나", translation: "What I took out" },
	{ label: "코드", keep: true, source: "pnpm create monti@latest", translation: "pnpm create monti@latest" },
];

const posts: readonly { title: string; path: string; blocks: string; kept?: string }[] = [
	{ title: "첫 번째 글", path: "/first-post", blocks: "블록 8", kept: "원문 따름 1" },
	{ title: "CMS elements", path: "/cms-elements", blocks: "블록 14" },
	{ title: "서울의 밤", path: "/seoul-night", blocks: "블록 6" },
];

/**
 * The review of a translation of several posts (flow 3, step 13): one group for the language, a row per post that opens to its blocks, source
 * beside translation. The first post is open.
 */
export function ProposalReviewTranslateScreen() {
	return (
		<AdminFrame open={null}>
			<PageColumn>
				<TextButton variant="quiet" size="note">
					<ChevronLeft aria-hidden />
					어시스턴트
				</TextButton>
				<Stack gap={0} paddingTop={2}>
					<PageHeader title="제안 검토" meta="10. 26 14:20">
						<Button variant="ghost">버리기</Button>
						<Button>3편 적용</Button>
					</PageHeader>
				</Stack>
				<PageBody>
					<Stack gap={32} paddingTop={16}>
						<ReviewQuote>“이 세 편 영어로 번역해 줘.”</ReviewQuote>
						<ReviewGroup title="번역 · English" meta="새 글 3편" actions={<TextButton>모두 펼치기</TextButton>}>
							{posts.map((post, index) => (
								<Collapsible key={post.path} defaultOpen={index === 0}>
									<ReviewItem
										included
										includeLabel={`${post.title} 넣기`}
										title={post.title}
										path={post.path}
										end={
											<Inline gap={8} align="baseline">
												<Count>{post.blocks}</Count>
												{post.kept ? <Count tone="warning">{post.kept}</Count> : null}
												<CollapsibleTrigger aria-label={`${post.title} 펼치기`}>
													<Caret solo />
												</CollapsibleTrigger>
											</Inline>
										}
									/>
									<CollapsibleContent>
										<ReviewCompareHead before="원문 · 한국어" after="번역 · English" />
										{blocks.map((block) => (
											<ReviewCompare
												key={block.label}
												included
												includeLabel={`${block.label} 넣기`}
												label={
													block.keep ? (
														<Inline gap={6}>
															{block.label}
															<Marker tone="keep">원문</Marker>
														</Inline>
													) : (
														block.label
													)
												}
												before={block.source}
												after={block.keep ? block.translation : <Fill>{block.translation}</Fill>}
											/>
										))}
										<ReviewMore open={false} onOpenChange={none} moreLabel="블록 4개 더" lessLabel="접기" />
									</CollapsibleContent>
								</Collapsible>
							))}
						</ReviewGroup>
					</Stack>
				</PageBody>
			</PageColumn>
		</AdminFrame>
	);
}
