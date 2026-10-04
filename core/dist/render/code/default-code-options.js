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
/** Default language list for code blocks. Change it with `createCodeHighlighter({ langs })`. */
export const DEFAULT_CODE_LANGS = [
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
/** Default language aliases for code blocks. Change them with `createCodeHighlighter({ langAlias })`. */
export const DEFAULT_CODE_LANG_ALIAS = {
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
/** Default light and dark themes for code blocks. Change them with `createCodeHighlighter({ themes })`. */
export const DEFAULT_CODE_THEMES = {
    light: oneLight,
    dark: oneDarkPro,
};
