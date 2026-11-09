import { Banner, StatusBar, StatusBarCell, StatusBarSpacer, TextButton } from "../../index";
import {
	BodyBlock,
	BodyHeading,
	EditorPage,
	EntryHeader,
	EntryProperties,
	EntryTitle,
	LanguageTabs,
	Paragraph,
} from "./editor-notion";
import { MainScreen } from "./main";

/**
 * The session ended: every save is refused until the person signs in again, so it is the whole site's state (status.md, the order of notices: a
 * banner, kept until it is dealt with). Edge to edge at the top of every screen, the editor's too: over its bar, above the entry's own banners.
 */
function SignedOutBanner() {
	return (
		<Banner tone="danger" title="로그인이 풀렸습니다" meta="저장하지 않은 입력은 이 브라우저에 남아 있습니다" plainMeta>
			<TextButton variant="underline">다시 로그인</TextButton>
		</Banner>
	);
}

/** The list when the session ended: the banner over the page, the page as it was. */
export function SignedOutListScreen() {
	return <MainScreen banner={<SignedOutBanner />} />;
}

/** The editor when the session ended while writing: the banner over the bar and the save cell saying so. "다시 로그인" goes to the login screen. */
export function SignedOutEditorScreen() {
	return (
		<EditorPage
			// The whole site's state stands over the editor's bar, where it stands over every screen; the bar's own banners (a conflict) stay under it.
			header={
				<>
					<SignedOutBanner />
					<EntryHeader address="/posts/first-post" status="editing" statusLabel="수정 중" />
				</>
			}
			head={<LanguageTabs />}
			side={<EntryProperties />}
			statusBar={
				<StatusBar>
					<StatusBarCell tone="danger">로그인이 풀렸습니다</StatusBarCell>
					<StatusBarCell render={<span />}>할 일 없음</StatusBarCell>
					<StatusBarSpacer />
					<StatusBarCell end render={<span />}>
						1,240자
					</StatusBarCell>
				</StatusBar>
			}
		>
			<EntryTitle>첫 번째 글</EntryTitle>
			<Paragraph>블로그를 다시 만들기로 한 건 글을 쓰는 시간보다 도구를 고치는 시간이 길어졌기 때문이다.</Paragraph>
			<BodyBlock gap={32}>
				<BodyHeading>무엇을 덜어냈나</BodyHeading>
			</BodyBlock>
			<BodyBlock gap={12}>
				<Paragraph>목록에는 제목과 주소, 지금 상태만 남겼다. 나머지는 필요할 때 꺼내 본다.</Paragraph>
			</BodyBlock>
			<BodyBlock gap={20}>
				<Paragraph>편집기도 같은 원칙으로 정리했다. 글을 쓰는 동안 보이는 건 글뿐이다.</Paragraph>
			</BodyBlock>
		</EditorPage>
	);
}
