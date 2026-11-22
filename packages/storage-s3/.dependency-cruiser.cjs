// Import rules of `@monti-cms/storage-s3` (docs/refactor/storage-s3.md, section 5).

module.exports = {
	forbidden: [
		{
			name: "types-imports-nothing-internal",
			comment: "types.ts imports nothing inside src/.",
			severity: "error",
			from: { path: "^src/types\\.ts$" },
			to: { path: "^src/" },
		},
		{
			name: "policy-imports-no-upper-layer",
			comment: "policy.ts (layer 0) imports nothing from config.ts, adapter.ts, or index.ts.",
			severity: "error",
			from: { path: "^src/policy\\.ts$" },
			to: { path: "^src/(?:config|adapter|index)\\.ts$" },
		},
		{
			name: "config-imports-no-upper-layer",
			comment: "config.ts (layer 1) imports nothing from adapter.ts or index.ts.",
			severity: "error",
			from: { path: "^src/config\\.ts$" },
			to: { path: "^src/(?:adapter|index)\\.ts$" },
		},
		{
			name: "nobody-imports-root-index",
			comment: "Nothing inside src/ imports src/index.ts except index.test.ts.",
			severity: "error",
			from: { path: "^src/(?!index\\.test\\.ts$)" },
			to: { path: "^src/index\\.ts$" },
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
