export const CODE_LANGUAGE_OPTIONS = [
    { label: "TypeScript", value: "ts" },
    { label: "TSX (React)", value: "tsx" },
    { label: "JavaScript", value: "js" },
    { label: "JSX", value: "jsx" },
    { label: "Python", value: "python" },
    { label: "Rust", value: "rust" },
    { label: "Go", value: "go" },
    { label: "Java", value: "java" },
    { label: "Kotlin", value: "kotlin" },
    { label: "C++", value: "cpp" },
    { label: "C#", value: "csharp" },
    { label: "Swift", value: "swift" },
    { label: "HTML", value: "html" },
    { label: "CSS", value: "css" },
    { label: "SCSS", value: "scss" },
    { label: "PostCSS", value: "postcss" },
    { label: "SQL", value: "sql" },
    { label: "JSON", value: "json" },
    { label: "YAML", value: "yaml" },
    { label: "TOML", value: "toml" },
    { label: "Markdown / MDX", value: "mdx" },
    { label: "Bash / Shell", value: "bash" },
    { label: "PowerShell", value: "powershell" },
    { label: "Dockerfile", value: "docker" },
    { label: "GraphQL", value: "graphql" },
    { label: "Plain Text", value: "text" },
];
/** The default language list followed by the site's extra languages (`codeBlock.languages`) that are not in it yet. The label of an extra language is its name. */
export const codeLanguageChoices = (extra) => [
    ...CODE_LANGUAGE_OPTIONS,
    ...[...new Set(extra)]
        .filter((name) => !CODE_LANGUAGE_OPTIONS.some((option) => option.value === name))
        .map((name) => ({ label: name, value: name })),
];
