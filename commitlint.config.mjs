// 커밋 메시지 검사(commitlint). Conventional Commits(`type(scope): subject`)를 따르고,
// 범위(scope)는 아래 목록만 쓸 수 있다(생략 가능). 메시지는 영어로 쓴다(한글이 있으면 실패).
// 훅은 `.husky/commit-msg`가 돌린다.

const HANGUL = /[ᄀ-ᇿ㄰-㆏가-힯]/;

export default {
	extends: ["@commitlint/config-conventional"],
	plugins: [
		{
			rules: {
				"english-only": ({ header, body, footer }) => {
					const written = [header, body, footer].some((part) => part && HANGUL.test(part));
					return [!written, "commit message must be written in English"];
				},
			},
		},
	],
	rules: {
		"english-only": [2, "always"],
		"scope-enum": [
			2,
			"always",
			["core", "admin", "ai", "blocks", "seo", "bareun", "example", "scripts", "ci", "deps", "release", "repo"],
		],
	},
};
