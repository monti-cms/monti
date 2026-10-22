import { defineMessages } from "@monti-cms/core";

/**
 * The texts the server side shows a person who can fix the problem (they reach the Git sync screen and the event log), in the admin language. Each says what is wrong,
 * where it is set, and how to fix it.
 */
export const serverMessages = defineMessages("cms-git-sync.server", {
	en: {
		pluginMissing:
			"The git-sync plugin is not in the site config. Where: `plugins` in monti.config.ts. Fix: add `gitSync({ targets: [...] })` (from @monti-cms/git-sync) to the list.",
		noTarget: 'There is no git-sync target "{id}"',
		noTargetIn: 'There is no git-sync target "{id}" (targets: {targets})',
		tokenUnreadable:
			"The saved GitHub token cannot be read, because MONTI_SECRET changed since it was saved. Where: the Git sync screen ({where}). Fix: enter the token again there, or put the old secret back (as MONTI_SECRET, or listed in `previousSecrets` in monti.config.ts).",
		tokenMissing:
			"No GitHub token is saved, so nothing is pushed or pulled yet. Where: the Git sync screen ({where}). Fix: choose or enter a GitHub token that can read and write the repo's contents there; `monti doctor` lists what else is missing.",
		formatMissing:
			'Target "{target}" writes files in the format "{format}", which this site does not have. Where: `plugins` in monti.config.ts, and `format` of the target. Fix: add the plugin that provides the format (mdx() from @monti-cms/mdx provides "mdx"; install the package first), or give the target another format.',
		formatCannotImport:
			'Format "{format}" cannot import, so target "{target}" cannot sync both ways. Where: `format` of the target in gitSync() of monti.config.ts. Fix: use a format that can read files back (mdx does).',
		targetBusy: 'Target "{target}" is busy (another sync is running); it will be retried',
		branchMissing:
			'The branch "{branch}" does not exist in {repo}. Where: `branch` of the target in gitSync() of monti.config.ts. Fix: create the branch in the repo (a new repo needs a first commit), or set `branch` to one that exists.',
		translationOfMissing:
			'{path} is a "{locale}" file with no entry yet; add `monti.translationOf` (the id of the source entry) to its front matter',
		queueFailedOne: "1 queued entry could not be synced ({entry}: {message}); it stays queued and is retried",
		queueFailedMany:
			"{count} queued entries could not be synced ({entry}: {message}); they stay queued and are retried",
		notCommitted: "The entry is queued but was not committed yet; it is retried",
		noConflict: "There is no such conflict",
		conflictChanged: "The file changed in git since you looked at it; reload the conflict",
		gitVersionUnreadable: "The git version cannot be read: {message}",
		gitVersionNoSlug: "The git version has no slug: add `slug` to its front matter",
		gitVersionNotWritten: "The git version could not be written to the entry: {message}",
		resolveBody: "`target`, `entryId` and `resolution` (git or server) are required",
	},
	ko: {
		pluginMissing:
			"사이트 설정에 git-sync 플러그인이 없어요. 위치: monti.config.ts의 `plugins`. 해결: 목록에 @monti-cms/git-sync의 `gitSync({ targets: [...] })`를 추가하세요.",
		noTarget: 'git-sync 대상 "{id}"이(가) 없어요',
		noTargetIn: 'git-sync 대상 "{id}"이(가) 없어요(대상: {targets})',
		tokenUnreadable:
			"저장된 GitHub 토큰을 읽을 수 없어요. 저장한 뒤 MONTI_SECRET이 바뀌었기 때문이에요. 위치: Git 동기화 화면({where}). 해결: 거기서 토큰을 다시 넣거나, 예전 비밀 값을 되돌리세요(MONTI_SECRET으로, 또는 monti.config.ts의 `previousSecrets`에 나열).",
		tokenMissing:
			"저장된 GitHub 토큰이 없어 아직 아무것도 올리거나 가져오지 않아요. 위치: Git 동기화 화면({where}). 해결: 거기서 저장소 콘텐츠를 읽고 쓸 수 있는 GitHub 토큰을 고르거나 넣으세요. 더 필요한 것은 `monti doctor`가 알려 줘요.",
		formatMissing:
			'대상 "{target}"은(는) 이 사이트에 없는 "{format}" 형식으로 파일을 써요. 위치: monti.config.ts의 `plugins`와 대상의 `format`. 해결: 그 형식을 주는 플러그인을 추가하거나(@monti-cms/mdx의 mdx()가 "mdx"를 줘요. 패키지를 먼저 설치하세요), 대상에 다른 형식을 지정하세요.',
		formatCannotImport:
			'"{format}" 형식은 가져오기를 할 수 없어 대상 "{target}"이(가) 양방향으로 동기화할 수 없어요. 위치: monti.config.ts의 gitSync()에 있는 대상의 `format`. 해결: 파일을 다시 읽을 수 있는 형식을 쓰세요(mdx는 돼요).',
		targetBusy: '대상 "{target}"이(가) 사용 중이에요(다른 동기화가 실행 중). 다시 시도해요',
		branchMissing:
			'{repo}에 브랜치 "{branch}"이(가) 없어요. 위치: monti.config.ts의 gitSync()에 있는 대상의 `branch`. 해결: 저장소에 브랜치를 만들거나(새 저장소는 첫 커밋이 필요해요), `branch`를 있는 것으로 바꾸세요.',
		translationOfMissing:
			'{path}은(는) 아직 글이 없는 "{locale}" 파일이에요. front matter에 `monti.translationOf`(원문 글의 id)를 추가하세요',
		queueFailedOne: "대기 중인 글 1개를 동기화하지 못했어요({entry}: {message}). 계속 대기하며 다시 시도해요",
		queueFailedMany: "대기 중인 글 {count}개를 동기화하지 못했어요({entry}: {message}). 계속 대기하며 다시 시도해요",
		notCommitted: "글이 대기열에 있지만 아직 커밋되지 않았어요. 다시 시도해요",
		noConflict: "그런 충돌이 없어요",
		conflictChanged: "보고 있던 사이 git의 파일이 바뀌었어요. 충돌을 다시 불러오세요",
		gitVersionUnreadable: "git 버전을 읽을 수 없어요: {message}",
		gitVersionNoSlug: "git 버전에 slug가 없어요. front matter에 `slug`를 추가하세요",
		gitVersionNotWritten: "git 버전을 글에 쓰지 못했어요: {message}",
		resolveBody: "`target`, `entryId`, `resolution`(git 또는 server)이 필요해요",
	},
});
