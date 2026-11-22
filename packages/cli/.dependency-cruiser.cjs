// Import rules of the CLI (docs/refactor/cli.md, section 6).

module.exports = {
	forbidden: [
		{
			name: "parse-imports-no-other-layer",
			comment: "parse/ (layer 0) imports nothing from migrate/, boot/, or commands/.",
			severity: "error",
			from: { path: "^src/parse/" },
			to: { path: "^src/(migrate|boot|commands)/" },
		},
		{
			name: "migrate-imports-only-parse",
			comment: "migrate/ (layer 1) imports nothing from boot/ or commands/.",
			severity: "error",
			from: { path: "^src/migrate/" },
			to: { path: "^src/(boot|commands)/" },
		},
		{
			name: "boot-imports-no-commands",
			comment: "boot/ (layer 2) imports nothing from commands/.",
			severity: "error",
			from: { path: "^src/boot/" },
			to: { path: "^src/commands/" },
		},
		{
			name: "nobody-imports-root-index-or-bin",
			comment: "Nothing inside src/ imports src/index.ts or src/bin.mjs except index.test.ts and bin.mjs.",
			severity: "error",
			from: { path: "^src/(?!(?:index\\.test\\.ts|bin\\.mjs)$)" },
			to: { path: "^src/(?:index\\.ts|bin\\.mjs)$" },
		},
		{
			name: "no-circular-imports",
			comment: "A cycle of imports, also one made only of `import type`.",
			severity: "error",
			from: {},
			to: { circular: true },
		},
	],
	options: {
		tsPreCompilationDeps: true,
		doNotFollow: { path: "node_modules" },
	},
};
