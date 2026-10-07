// Module `withCms` links in place of an optional dependency that is not installed (e.g. `mermaid` for the blocks extension). It is only loaded when that feature is used,
// so loading it tells the user to install the package. Being CommonJS, named imports do not break the build either.
throw new Error(
	"[@monti-cms/core] This feature needs an optional package that is not installed. Where: package.json of your app (the package is named in the build error just above this one, for example mermaid for the Mermaid block or recharts for the chart block). Fix: install it with your package manager (for example `pnpm add mermaid`) and restart the dev server.",
);
