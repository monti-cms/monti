// Module `withCms` links in place of an optional dependency that is not installed (e.g. `mermaid` for the blocks extension). It is only loaded when that feature is used,
// so loading it tells the user to install the package. Being CommonJS, named imports do not break the build either.
throw new Error(
	"[@monti-cms/core] This feature needs an optional package that is not installed. Install it and restart the dev server.",
);
