/* 在真实内容源中创建文章草稿，避免写入会被同步覆盖的副本。 */

import fs from "node:fs";
import path from "node:path";
import { parse as parseYaml } from "yaml";
import { resolveContentSource } from "./content/resolve-source.mjs";

/**
 * 站点时区（IANA 名）解析。
 *
 * 必须用站点时区、不能用机器时区：`validatePublicationMetadata()`
 * （src/utils/content-date.ts）按 `siteConfig.timeZone` 把 `publishedAt` 映射成
 * 日历日期再与 `published` 比对，两者不在同一天会直接构建报错。
 * 若用「机器本地日期 + 固定偏移」，机器时区与站点时区不在同一天时
 * （例如 UTC 机器在 16:00–24:00 之间，此时站点时区已是次日）就会写出必然失败的文章。
 *
 * 优先级：`SHIRONE_TZ` 环境变量 → 内容仓覆盖层 → `src/config/siteConfig.ts` → 机器时区。
 */
const SITE_TIME_ZONE_FILES = [
	// 内容分离模式：由内容仓 config/site.yaml 生成，site 领域下可能有 timeZone
	"src/user/user-config.ts",
	"src/config/siteConfig.ts",
];

function readTimeZoneLiteral(file, { onlySiteDomain = false } = {}) {
	if (!fs.existsSync(file)) return null;
	const source = fs.readFileSync(file, "utf8");
	// 覆盖层里其它领域也可能出现 timeZone，先裁出 `const site` 这一段
	const scope = onlySiteDomain
		? source.match(
				/(?:^|\n)const\s+site[\s\S]*?(?=\nconst\s|\nexport\s|$)/,
			)?.[0]
		: source;
	return scope?.match(/\btimeZone\s*:\s*["'`]([^"'`]+)["'`]/)?.[1] ?? null;
}

function resolveSiteTimeZone(contentRoot) {
	const override = process.env.SHIRONE_TZ?.trim();
	if (override) return override;
	if (contentRoot) {
		for (const name of ["site.yaml", "site.yml"]) {
			const file = path.join(contentRoot, "config", name);
			if (!fs.existsSync(file)) continue;
			const timeZone = parseYaml(fs.readFileSync(file, "utf8"))?.timeZone;
			if (timeZone) return timeZone;
		}
	}
	for (const [index, file] of SITE_TIME_ZONE_FILES.entries()) {
		if (contentRoot && index === 0) continue;
		const literal = readTimeZoneLiteral(file, { onlySiteDomain: index === 0 });
		if (literal) return literal;
	}
	return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/** 指定时区下「现在」的日历日期与带偏移的精确时间（h23 避免 24:00 这种写法）。 */
function getZonedNow(timeZone) {
	const parts = Object.fromEntries(
		new Intl.DateTimeFormat("en-US", {
			timeZone,
			year: "numeric",
			month: "2-digit",
			day: "2-digit",
			hour: "2-digit",
			minute: "2-digit",
			second: "2-digit",
			hourCycle: "h23",
			timeZoneName: "longOffset",
		})
			.formatToParts(new Date())
			.map((part) => [part.type, part.value]),
	);
	// `longOffset` 对 UTC 只返回 "GMT"，这里补成 +00:00
	const offset = (parts.timeZoneName ?? "GMT").replace("GMT", "") || "+00:00";
	const date = `${parts.year}-${parts.month}-${parts.day}`;

	return {
		date,
		datetime: `${date}T${parts.hour}:${parts.minute}:${parts.second}${offset}`,
	};
}

const args = process.argv.slice(2);

if (args.length !== 1) {
	console.error("请提供文章文件名。用法：pnpm new-post <文件名>");
	process.exit(1);
}

let fileName = args[0];

// 允许子目录，但不能越出文章目录。
if (path.isAbsolute(fileName) || fileName.split(/[\\/]/).includes("..")) {
	console.error("文章文件名必须是文章目录内的相对路径，不能包含 ..。");
	process.exit(1);
}

// 未指定扩展名时使用 Markdown。
const fileExtensionRegex = /\.(md|mdx)$/i;
if (!fileExtensionRegex.test(fileName)) {
	fileName += ".md";
}

let contentRoot;
let targetDir;
try {
	const source = resolveContentSource();
	targetDir = path.resolve("src/content/posts");
	if (source.mode === "external") {
		if (source.source.type !== "path") {
			throw new Error(
				"当前使用远端内容仓。请先克隆内容仓并设置 CONTENT_DIR，再创建文章；不能写入同步副本。",
			);
		}
		contentRoot = path.resolve(source.source.path);
		if (
			!fs.existsSync(contentRoot) ||
			!fs.statSync(contentRoot).isDirectory()
		) {
			throw new Error("CONTENT_DIR 指向的内容目录不存在，请检查本地配置。");
		}
		const mount = Object.entries(source.mounts).find(([, destination]) => {
			const remainder = path.relative(path.resolve(destination), targetDir);
			return (
				!path.isAbsolute(remainder) &&
				remainder !== ".." &&
				!remainder.startsWith(`..${path.sep}`)
			);
		});
		if (!mount) throw new Error("内容源没有挂载文章目录，无法创建草稿。");
		targetDir = path.resolve(
			contentRoot,
			mount[0],
			path.relative(path.resolve(mount[1]), targetDir),
		);
	}
} catch (error) {
	console.error(`创建文章失败：${error.message}`);
	process.exit(1);
}
const fullPath = path.join(targetDir, fileName);

if (fs.existsSync(fullPath)) {
	console.error(`文章已存在，不会覆盖：${fullPath}`);
	process.exit(1);
}

// 写入前先解析时区，非法配置不要留下半成品文件
let timeZone;
let zonedNow;
try {
	timeZone = resolveSiteTimeZone(contentRoot);
	zonedNow = getZonedNow(timeZone);
} catch (error) {
	console.error(
		`无法解析站点时区 ${JSON.stringify(timeZone)}：${error.message}。请检查 site.yaml 或 SHIRONE_TZ。`,
	);
	process.exit(1);
}

// `published` 与 `publishedAt` 出自同一次时区换算，保证在站点时区下同一天
const content = `---
title: ${JSON.stringify(args[0])}
published: ${zonedNow.date}
publishedAt: ${zonedNow.datetime}
description: ''
image: ''
tags: []
category: ''
draft: true
lang: ''
---
`;

fs.mkdirSync(path.dirname(fullPath), { recursive: true });
fs.writeFileSync(fullPath, content, { flag: "wx" });

console.log(`已创建文章草稿：${fullPath}`);
