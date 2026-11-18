// Import rules of the core (docs/refactor/core.md, section 8). `pnpm lint:deps` runs them from `packages/core` with the dependency-cruiser CLI, which
// is installed at the repository root, over `src`. The paths below are relative to `packages/core`.

module.exports = {
	forbidden: [
		{
			name: "layer-0-imports-no-other-folder",
			comment: "db/ and rich-text/ import nothing from the engine, the resources, or each other.",
			severity: "error",
			from: { path: "^src/(db|rich-text)/" },
			to: { path: "^src/(engine|resources|db|rich-text)/", pathNot: "^src/$1/" },
		},
		{
			name: "engine-imports-no-resources",
			comment: "The engine imports only db/ and rich-text/: index.ts assembles it with the resources.",
			severity: "error",
			from: { path: "^src/engine/" },
			to: { path: "^src/resources/" },
		},
		{
			name: "nobody-imports-the-root-index",
			comment:
				"Nothing inside src/ imports src/index.ts: it only assembles the layers. A folder's own index.ts is not this file. The one exception is src/index.test.ts, the test of that file.",
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
		// Count `import type` as an import: a layer breach or a cycle made of types is still a breach.
		tsPreCompilationDeps: true,
		doNotFollow: { path: "node_modules" },
	},
};
