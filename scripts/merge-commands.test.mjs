import assert from "node:assert/strict";
import { test } from "node:test";
import { commandsOf, mergesIn } from "./merge-commands.mjs";

const M = "gh pr merge";
const pr = (pull, more = {}) => ({ how: "pr", pull, repo: undefined, head: undefined, ...more });

test("a merge where a command starts is seen, with what it names", () => {
	assert.deepEqual(mergesIn(`${M} 461 --squash`), [pr("461")]);
	assert.deepEqual(mergesIn(`${M}`), [pr(undefined)]);
	assert.deepEqual(mergesIn(`${M} --squash --delete-branch`), [pr(undefined)]);
	assert.deepEqual(mergesIn(`${M} feat/unread --squash`), [pr("feat/unread")]);
	assert.deepEqual(mergesIn(`${M} https://github.com/o/r/pull/9 -s`), [pr("https://github.com/o/r/pull/9")]);
	assert.deepEqual(mergesIn(`cd packages && ${M} 461`), [pr("461")]);
	assert.deepEqual(mergesIn(`GH_TOKEN=x ${M} 461`), [pr("461")]);
	assert.deepEqual(mergesIn(`/opt/homebrew/bin/${M} 461`), [pr("461")]);
});

test("its flags are read, and a flag's value is not taken for the pull request", () => {
	assert.deepEqual(mergesIn(`${M} --subject "fix: 12 things" -b body 461`), [pr("461")]);
	assert.deepEqual(mergesIn(`${M} 461 --repo o/r --match-head-commit abc123`), [
		pr("461", { repo: "o/r", head: "abc123" }),
	]);
	assert.deepEqual(mergesIn(`${M} 461 --match-head-commit=abc123 -R o/r`), [
		pr("461", { repo: "o/r", head: "abc123" }),
	]);
	assert.deepEqual(mergesIn(`gh -R o/r pr merge 461`), [pr("461", { repo: "o/r" })]);
	assert.deepEqual(mergesIn(`${M} 461 --squash 2>&1 | tail -3`), [pr("461")]);
	assert.deepEqual(mergesIn(`${M} > out.txt`), [pr(undefined)]);
});

test("every merge of a line is seen, and the ones a shell is handed", () => {
	assert.deepEqual(mergesIn(`${M} 461 --squash && ${M} 462 --squash`), [pr("461"), pr("462")]);
	assert.deepEqual(mergesIn(`bash -c "${M} 461 --squash"`), [pr("461")]);
	assert.deepEqual(mergesIn(`sh -lc '${M} 461'`), [pr("461")]);
	assert.deepEqual(mergesIn(`eval "${M} 461"`), [pr("461")]);
	assert.deepEqual(mergesIn(`echo $(${M} 461)`), [pr("461")]);
	assert.deepEqual(mergesIn(`echo "done: \`${M} 461\`"`), [pr("461")]);
	assert.deepEqual(mergesIn(`git push\n${M} 461`), [pr("461")]);
	assert.deepEqual(mergesIn(`(cd x; ${M} 461)`), [pr("461")]);
});

test("a merge through the API is seen", () => {
	assert.deepEqual(mergesIn("gh api repos/o/r/pulls/461/merge -X PUT"), [{ how: "api", pull: "461", repo: "o/r" }]);
	assert.deepEqual(mergesIn("gh api -X PUT /repos/o/r/pulls/461/merge -f merge_method=squash"), [
		{ how: "api", pull: "461", repo: "o/r" },
	]);
	assert.deepEqual(mergesIn("gh api repos/o/r/pulls/461"), []);
});

test("words that only mention a merge are not one", () => {
	assert.deepEqual(mergesIn(`git commit -m "docs: say what ${M} checks"`), []);
	assert.deepEqual(mergesIn(`echo "example; ${M} 461 --squash"`), []);
	assert.deepEqual(mergesIn(`grep -rn '${M}' scripts`), []);
	assert.deepEqual(mergesIn(`ls # ${M} 461`), []);
	assert.deepEqual(mergesIn(`cat > note.md <<'EOF'\n${M} 461\nEOF\nls`), []);
	assert.deepEqual(mergesIn(`python3 - <<EOF\nprint("x")\n${M} 1\nEOF`), []);
	assert.deepEqual(mergesIn("gh pr view 461"), []);
	assert.deepEqual(mergesIn("gh pr list --search merge"), []);
});

test("what follows a here-document is still read", () => {
	assert.deepEqual(mergesIn(`cat <<'EOF' > a\ntext\nEOF\n${M} 461`), [pr("461")]);
});

test("a quoted word stays one word", () => {
	assert.deepEqual(commandsOf(`a "b c" 'd; e' f\\ g`), [["a", "b c", "d; e", "f g"]]);
});
