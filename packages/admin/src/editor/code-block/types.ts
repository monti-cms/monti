export interface ParsedCodeBlockMeta {
	title: string;
	showLineNumbers: boolean;
	raw: Record<string, unknown>;
}

export interface CodeLanguageOption {
	label: string;
	value: string;
}
