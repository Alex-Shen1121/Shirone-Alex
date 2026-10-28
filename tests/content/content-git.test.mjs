import assert from "node:assert/strict";
import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import test from "node:test";
import { execContentGit } from "../../scripts/content/git.mjs";

test("未提供部署密钥时保留普通 Git 调用行为", () => {
	assert.match(
		execContentGit(["--version"], {
			encoding: "utf8",
			env: { ...process.env, CONTENT_REPO_SSH_KEY: "" },
		}),
		/^git version /,
	);
});

test("部署密钥不会传入 Git 环境，成功或失败后都清理临时文件", {
	skip: process.platform === "win32",
}, () => {
	const root = mkdtempSync(join(tmpdir(), "shirone-git-test-"));
	const previous = process.env.TMPDIR;
	const keyDirectory = join(root, "临时 ' 目录");
	const trace = join(root, "trace.json");
	try {
		mkdirSync(keyDirectory);
		process.env.TMPDIR = keyDirectory;
		writeFileSync(
			join(root, "git"),
			'#!/bin/sh\nexec sh -c "$GIT_SSH_COMMAND"\n',
			{ mode: 0o755 },
		);
		writeFileSync(
			join(root, "ssh"),
			`#!/usr/bin/env node
const fs = require("node:fs");
const args = process.argv.slice(2);
const key = args[args.indexOf("-i") + 1];
fs.writeFileSync(process.env.TEST_TRACE, JSON.stringify({
  key, mode: fs.statSync(key).mode & 0o777,
  content: fs.readFileSync(key, "utf8"),
  exposed: Boolean(process.env.CONTENT_REPO_SSH_KEY),
  strict: args.includes("StrictHostKeyChecking=yes"),
}));
process.exit(Number(process.env.TEST_EXIT));
`,
			{ mode: 0o755 },
		);
		for (const code of [0, 17]) {
			const run = () =>
				execContentGit(["fetch"], {
					encoding: "utf8",
					env: {
						...process.env,
						PATH: `${root}${delimiter}${process.env.PATH}`,
						CONTENT_REPO_SSH_KEY: "测试专用密钥",
						TEST_TRACE: trace,
						TEST_EXIT: String(code),
					},
				});
			if (code) assert.throws(run, (error) => error.status === code);
			else run();
			const observed = JSON.parse(readFileSync(trace, "utf8"));
			assert.equal(observed.mode, 0o600);
			assert.equal(observed.content, "测试专用密钥\n");
			assert.equal(observed.exposed, false);
			assert.equal(observed.strict, true);
			assert.equal(existsSync(observed.key), false);
		}
	} finally {
		if (previous === undefined) delete process.env.TMPDIR;
		else process.env.TMPDIR = previous;
		rmSync(root, { recursive: true, force: true });
	}
});
