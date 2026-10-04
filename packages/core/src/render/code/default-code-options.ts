import bash from "@shikijs/langs/bash";
import cpp from "@shikijs/langs/cpp";
import csharp from "@shikijs/langs/csharp";
import csv from "@shikijs/langs/csv";
import docker from "@shikijs/langs/docker";
import dotenv from "@shikijs/langs/dotenv";
import go from "@shikijs/langs/go";
import graphql from "@shikijs/langs/graphql";
import html from "@shikijs/langs/html";
import java from "@shikijs/langs/java";
import jsonc from "@shikijs/langs/jsonc";
import kotlin from "@shikijs/langs/kotlin";
import lit from "@shikijs/langs/lit";
import mdx from "@shikijs/langs/mdx";
import mermaid from "@shikijs/langs/mermaid";
import nginx from "@shikijs/langs/nginx";
import postcss from "@shikijs/langs/postcss";
import powershell from "@shikijs/langs/powershell";
import python from "@shikijs/langs/python";
import rust from "@shikijs/langs/rust";
import scss from "@shikijs/langs/scss";
import solidity from "@shikijs/langs/solidity";
import sql from "@shikijs/langs/sql";
import svelte from "@shikijs/langs/svelte";
import swift from "@shikijs/langs/swift";
import toml from "@shikijs/langs/toml";
import ts from "@shikijs/langs/ts";
import tsx from "@shikijs/langs/tsx";
import vue from "@shikijs/langs/vue";
import yaml from "@shikijs/langs/yaml";
import oneDarkPro from "@shikijs/themes/one-dark-pro";
import oneLight from "@shikijs/themes/one-light";
import type { LanguageInput, ThemeRegistrationAny } from "shiki/core";

/** 코드 블록 기본 언어 목록. `createCodeHighlighter({ langs })`로 바꾼다. */
export const DEFAULT_CODE_LANGS: LanguageInput[] = [
	ts,
	tsx,
	vue,
	svelte,
	lit,
	html,
	scss,
	postcss,
	python,
	java,
	kotlin,
	go,
	rust,
	cpp,
	csharp,
	swift,
	solidity,
	jsonc,
	yaml,
	toml,
	sql,
	graphql,
	mdx,
	csv,
	docker,
	nginx,
	bash,
	powershell,
	dotenv,
	mermaid,
];

/** 코드 블록 기본 언어 별칭. `createCodeHighlighter({ langAlias })`로 바꾼다. */
export const DEFAULT_CODE_LANG_ALIAS: Record<string, string> = {
	javascript: "ts",
	js: "ts",
	css: "scss",
	"c#": "csharp",
	json: "jsonc",
	yml: "yaml",
	dockerfile: "docker",
	md: "mdx",
	txt: "text",
	plain: "text",
};

/** 코드 블록 기본 밝은·어두운 테마. `createCodeHighlighter({ themes })`로 바꾼다. */
export const DEFAULT_CODE_THEMES: { light: ThemeRegistrationAny; dark: ThemeRegistrationAny } = {
	light: oneLight,
	dark: oneDarkPro,
};
