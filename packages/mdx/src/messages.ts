/** The plugin's words in the admin's two languages. */
export const mdxWords = {
	en: { unknown: (name: string) => `Unknown component ${name}`, view: "View as MDX" },
	ko: { unknown: (name: string) => `모르는 컴포넌트 ${name}`, view: "MDX로 보기" },
};
export type MdxLanguage = keyof typeof mdxWords;
