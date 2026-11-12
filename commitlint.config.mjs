// Commit message check (commitlint). Follows Conventional Commits (`type(scope): subject`), and
// the scope can only be one of the values below (optional). Messages are written in English (fails if Hangul is present).
// The hook is run by `.husky/commit-msg`.

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
			// The packages that exist, and the repo's own areas. A new package adds its scope here.
			["core", "ui", "admin", "next", "examples", "scripts", "ci", "deps", "release", "repo"],
		],
	},
};
