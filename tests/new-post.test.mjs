import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

/**
 * `scripts/new-post.js` 的时区契约。
 *
 * 脚手架必须把 `published` 与 `publishedAt` 都算在 `siteConfig.timeZone` 下：
 * `validatePublicationMetadata()`（src/utils/content-date.ts）会按站点时区把
 * `publishedAt` 映射成日历日期再与 `published` 比对，不一致即构建失败。
 * 这些用例覆盖「机器时区 ≠ 站点时区」的场景（UTC 机器、内容仓覆盖、显式覆盖）。
 */
const SCRIPT = fileURLToPath(
	new URL("../scripts/new-post.js", import.meta.url),
);

/** 与 validatePublicationMetadata 同一判定：该瞬间在指定时区下的日历日期。 */
function dateInTimeZone(instant, timeZone) {
	const parts = Object.fromEntries(
		new Intl.DateTimeFormat("en-US", {
			timeZone,
			year: "numeric",
			month: "2-digit",
			day: "2-digit",
		})
			.formatToParts(new Date(instant))
			.map((part) => [part.type, part.value]),
	);
	return `${parts.year}-${parts.month}-${parts.day}`;
}

function makeProject({ siteTimeZone, overlayTimeZone } = {}) {
	const root = mkdtempSync(join(tmpdir(), "shirone-new-post-"));
	mkdirSync(join(root, "src", "config"), { recursive: true });
	if (siteTimeZone) {
		writeFileSync(
			join(root, "src", "config", "siteConfig.ts"),
			`export const siteConfig = {\n\ttimeZone: ${JSON.stringify(siteTimeZone)},\n};\n`,
		);
	}
	if (overlayTimeZone) {
		mkdirSync(join(root, "src", "user"), { recursive: true });
		writeFileSync(
			join(root, "src", "user", "user-config.ts"),
			`const site: DeepPartial<SiteConfig> = {\n\ttimeZone: ${JSON.stringify(overlayTimeZone)},\n};\n\nexport const userConfigOverrides: Readonly<Record<string, unknown>> = {\n\tsite,\n};\n`,
		);
	}
	return root;
}

function scaffold(root, { name = "post", env = {} } = {}) {
	const childEnv = { ...process.env };
	delete childEnv.SHIRONE_TZ;
	execFileSync(process.execPath, [SCRIPT, name], {
		cwd: root,
		env: { ...childEnv, ...env },
		stdio: "pipe",
	});
	const markdown = readFileSync(
		join(root, "src", "content", "posts", `${name}.md`),
		"utf8",
	);
	const body = markdown.split("---")[1] ?? "";
	const read = (key) =>
		body.match(new RegExp(`^${key}:\\s*(.+)$`, "m"))?.[1]?.trim();
	return { published: read("published"), publishedAt: read("publishedAt") };
}

function withProject(options, run) {
	const root = makeProject(options);
	try {
		run(root);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
}

describe("scripts/new-post.js 的时区契约", () => {
	it("默认站点时区下，publishedAt 落在 published 当天（与机器时区无关）", () => {
		for (const machineTimeZone of [
			"UTC",
			"Pacific/Kiritimati", // UTC+14：本地日期领先站点时区
			"America/New_York",
			"Asia/Shanghai",
		]) {
			withProject({ siteTimeZone: "Asia/Shanghai" }, (root) => {
				const { published, publishedAt } = scaffold(root, {
					env: { TZ: machineTimeZone },
				});
				assert.ok(publishedAt, "publishedAt 必须被写入");
				assert.equal(
					dateInTimeZone(publishedAt, "Asia/Shanghai"),
					published,
					`机器时区 ${machineTimeZone} 下 published/publishedAt 必须同一天`,
				);
			});
		}
	});

	it("跟随站点配置的时区，而不是硬编码 +08:00", () => {
		withProject({ siteTimeZone: "America/New_York" }, (root) => {
			const { published, publishedAt } = scaffold(root, {
				env: { TZ: "UTC" },
			});
			// 纽约夏令时 -04:00 / 冬令时 -05:00
			assert.match(publishedAt, /-0[45]:00$/);
			assert.equal(dateInTimeZone(publishedAt, "America/New_York"), published);
		});
	});

	it("内容仓覆盖层（src/user/user-config.ts）优先于 siteConfig.ts", () => {
		withProject(
			{
				siteTimeZone: "Asia/Shanghai",
				overlayTimeZone: "Pacific/Auckland",
			},
			(root) => {
				const { published, publishedAt } = scaffold(root, {
					env: { TZ: "UTC" },
				});
				// 奥克兰夏令时 +13:00 / 冬令时 +12:00
				assert.match(publishedAt, /\+1[23]:00$/);
				assert.equal(
					dateInTimeZone(publishedAt, "Pacific/Auckland"),
					published,
				);
			},
		);
	});

	it("SHIRONE_TZ 覆盖配置与覆盖层", () => {
		withProject(
			{
				siteTimeZone: "Asia/Shanghai",
				overlayTimeZone: "Pacific/Auckland",
			},
			(root) => {
				const { published, publishedAt } = scaffold(root, {
					name: "override",
					env: { TZ: "UTC", SHIRONE_TZ: "Europe/Berlin" },
				});
				// 柏林夏令时 +02:00 / 冬令时 +01:00
				assert.match(publishedAt, /\+0[12]:00$/);
				assert.equal(dateInTimeZone(publishedAt, "Europe/Berlin"), published);
			},
		);
	});

	it("没有配置时回落到机器时区", () => {
		withProject({}, (root) => {
			const { published, publishedAt } = scaffold(root, {
				name: "fallback",
				env: { TZ: "Asia/Tokyo" },
			});
			assert.match(publishedAt, /\+09:00$/);
			assert.equal(dateInTimeZone(publishedAt, "Asia/Tokyo"), published);
		});
	});

	it("非法时区：报错退出，不留下半成品文件", () => {
		withProject({ siteTimeZone: "Not/AZone" }, (root) => {
			assert.throws(
				() => scaffold(root, { name: "bad-tz" }),
				/无法解析站点时区 "Not\/AZone"/,
			);
			assert.equal(
				existsSync(join(root, "src", "content", "posts", "bad-tz.md")),
				false,
			);
		});
	});
});

describe("新建文章的内容源契约", () => {
	it("直接写入内容仓，使用尚未同步的时区，后续同步不会丢稿", () => {
		withProject({ siteTimeZone: "UTC" }, (root) => {
			const contentRoot = join(root, "content-source");
			mkdirSync(join(contentRoot, "config"), { recursive: true });
			writeFileSync(
				join(contentRoot, "config/site.yaml"),
				"timeZone: Asia/Shanghai\n",
			);
			writeFileSync(join(root, ".env"), `CONTENT_DIR="${contentRoot}"\n`);
			execFileSync(process.execPath, [SCRIPT, "notes/第一篇"], {
				cwd: root,
				stdio: "pipe",
			});
			const post = join(contentRoot, "content/posts/notes/第一篇.md");
			const text = readFileSync(post, "utf8");
			assert.match(text, /draft: true/);
			assert.match(text, /publishedAt: .*\+08:00/);
			assert.equal(
				existsSync(join(root, "src/content/posts/notes/第一篇.md")),
				false,
			);
			// 同步夹具只测试文章目录；移除需要完整主题类型的配置覆盖。
			rmSync(join(contentRoot, "config"), { recursive: true });
			const sync = fileURLToPath(
				new URL("../scripts/content/sync.mjs", import.meta.url),
			);
			execFileSync(process.execPath, [sync], { cwd: root, stdio: "pipe" });
			assert.equal(readFileSync(post, "utf8"), text);
			assert.equal(
				readFileSync(join(root, "src/content/posts/notes/第一篇.md"), "utf8"),
				text,
			);
		});
	});

	it("远端源拒绝写入同步副本，已有稿件不受影响", () => {
		withProject({}, (root) => {
			writeFileSync(
				join(root, "shirone.content.json"),
				JSON.stringify({
					schemaVersion: 1,
					source: {
						type: "git",
						url: "https://example.com/content.git",
						ref: "main",
					},
				}),
			);
			assert.throws(() => scaffold(root), /请先克隆内容仓并设置 CONTENT_DIR/);
			assert.equal(existsSync(join(root, "src/content/posts/post.md")), false);
		});
	});

	it("尊重自定义文章挂载并拒绝越界文件名", () => {
		withProject({}, (root) => {
			const source = join(root, "writing");
			mkdirSync(source);
			writeFileSync(
				join(root, "shirone.content.json"),
				JSON.stringify({
					schemaVersion: 1,
					source: { type: "path", path: "writing" },
					mounts: { content: false, articles: "src/content/posts" },
				}),
			);
			execFileSync(process.execPath, [SCRIPT, "first"], {
				cwd: root,
				stdio: "pipe",
			});
			assert.ok(existsSync(join(source, "articles/first.md")));
			assert.throws(
				() =>
					execFileSync(process.execPath, [SCRIPT, "../outside"], {
						cwd: root,
						stdio: "pipe",
					}),
				/不能包含/,
			);
			assert.throws(
				() =>
					execFileSync(process.execPath, [SCRIPT, "first"], {
						cwd: root,
						stdio: "pipe",
					}),
				/不会覆盖/,
			);
		});
	});
});
