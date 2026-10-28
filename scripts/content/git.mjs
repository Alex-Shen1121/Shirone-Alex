import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

/** 构建密钥只写入临时私有目录，Git 结束后立即清理。 */
export function execContentGit(args, options = {}) {
	const { CONTENT_REPO_SSH_KEY: key, ...env } = options.env ?? process.env;
	if (!key?.trim()) return execFileSync("git", args, options);
	const directory = mkdtempSync(join(tmpdir(), "shirone-content-key-"));
	try {
		const identity = join(directory, "identity");
		writeFileSync(identity, `${key.trim()}\n`, { mode: 0o600 });
		const knownHosts = fileURLToPath(
			new URL("./github-known-hosts", import.meta.url),
		);
		const quote = (value) => `'${value.replaceAll("'", "'\\''")}'`;
		const command = [
			"ssh",
			"-i",
			identity,
			"-o",
			"BatchMode=yes",
			"-o",
			"IdentitiesOnly=yes",
			"-o",
			"StrictHostKeyChecking=yes",
			"-o",
			`UserKnownHostsFile=${knownHosts}`,
		]
			.map(quote)
			.join(" ");
		return execFileSync("git", args, {
			...options,
			env: { ...env, GIT_SSH_COMMAND: command, GIT_SSH_VARIANT: "ssh" },
		});
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
}
