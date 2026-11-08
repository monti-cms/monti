import type { CDPSession } from "playwright";

const INITIALS = "ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ";
const FIRST = 0xac00;
const LAST = 0xd7a3;

/** What a Korean keyboard shows while one syllable is typed: "각" is ㄱ, 가, 각. Not Hangul: null. */
function stages(char: string): string[] | null {
	const code = char.codePointAt(0) ?? 0;
	if (code < FIRST || code > LAST) return null;
	const offset = code - FIRST;
	const initial = INITIALS[Math.floor(offset / 588)] ?? "";
	const open = String.fromCodePoint(code - (offset % 28));
	return offset % 28 === 0 ? [initial, open] : [initial, open, char];
}

/** Types Hangul through an input method, syllable by syllable, into whatever has the focus (the same way as `testing/commands.ts`). */
export async function typeKoreanInto(session: CDPSession, text: string) {
	let composing = "";
	for (const char of text) {
		const steps = stages(char);
		if (composing) await session.send("Input.insertText", { text: composing });
		composing = "";
		if (!steps) {
			await session.send("Input.insertText", { text: char });
			continue;
		}
		for (const step of steps)
			await session.send("Input.imeSetComposition", {
				text: step,
				selectionStart: step.length,
				selectionEnd: step.length,
			});
		composing = char;
	}
	if (composing) await session.send("Input.insertText", { text: composing });
}
