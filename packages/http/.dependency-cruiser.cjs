// Import rules of @monti-cms/http (docs/refactor/http.md, section 6).

module.exports = {
	forbidden: [
		{
			name: "protocol-imports-no-other-layer",
			comment: "protocol/ (layer 0) imports nothing from routing/ or handler/.",
			severity: "error",
			from: { path: "^src/protocol/" },
			to: { path: "^src/(routing|handler)/" },
		},
		{
			name: "routing-imports-no-handler",
			comment: "routing/ (layer 1) imports nothing from handler/.",
			severity: "error",
			from: { path: "^src/routing/" },
			to: { path: "^src/handler/" },
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
