import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { docOf } from "../../../test/mdx";
import { DocPreview, SourcePane } from "../source-pane";

afterEach(cleanup);

const bodyText = () => document.querySelector(".ProseMirror")?.textContent ?? "";

describe("DocPreview", () => {
	it("shows a stored document as the post would show it, read-only", async () => {
		render(<DocPreview doc={docOf("## 제목\n\n본문 **굵게**\n")} />);
		await waitFor(() => expect(bodyText()).toContain("본문 굵게"));
		expect(bodyText()).toContain("제목");
		expect(document.querySelector(".ProseMirror")?.getAttribute("contenteditable")).toBe("false");
		expect(document.querySelector(".ProseMirror strong")?.textContent).toBe("굵게");
	});

	it("shows the new document when it changes", async () => {
		const { rerender } = render(<DocPreview doc={docOf("처음 본문")} />);
		await waitFor(() => expect(bodyText()).toContain("처음 본문"));
		rerender(<DocPreview doc={docOf("바뀐 본문")} />);
		await waitFor(() => expect(bodyText()).toContain("바뀐 본문"));
		expect(bodyText()).not.toContain("처음 본문");
	});

	it("does not start over for a document that says the same, with other block ids", async () => {
		const first = docOf("같은 본문");
		const { rerender } = render(<DocPreview doc={first} />);
		await waitFor(() => expect(bodyText()).toContain("같은 본문"));
		const editor = document.querySelector(".ProseMirror");
		rerender(<DocPreview doc={docOf("같은 본문")} />);
		expect(document.querySelector(".ProseMirror")).toBe(editor);
	});
});

describe("SourcePane", () => {
	it("shows the source document under its title, and closes", async () => {
		const onClose = vi.fn();
		render(
			<SourcePane doc={docOf("원문 첫 문단\n\n원문 둘째 문단\n")} locale="ko" title="원문 제목" onClose={onClose} />,
		);
		expect(screen.getByRole("heading", { name: "원문 제목" })).toBeTruthy();
		await waitFor(() => expect(bodyText()).toContain("원문 둘째 문단"));
		screen.getByRole("button", { name: /닫기|Close/ }).click();
		expect(onClose).toHaveBeenCalled();
	});
});
