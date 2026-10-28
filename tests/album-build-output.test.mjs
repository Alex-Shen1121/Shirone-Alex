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
import { join } from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";
import { shirones } from "../src/integration/index.ts";

test("关闭搜索索引时仍清除发布目录中的相册源配置，并保留图片和源文件", async () => {
	const root = mkdtempSync(join(tmpdir(), "shirone-album-output-"));
	const output = join(root, "中文 产物");
	const album = join(output, "images", "albums", "protected");
	const original = join(root, "info.json");
	try {
		mkdirSync(album, { recursive: true });
		writeFileSync(original, "私有相册配置");
		writeFileSync(join(album, "info.json"), "私有相册配置");
		writeFileSync(join(album, "cover.webp"), "图片");
		const hook = shirones({ pagefind: false }).hooks["astro:build:done"];
		await hook({ dir: pathToFileURL(`${output}/`) });
		assert.equal(existsSync(join(album, "info.json")), false);
		assert.equal(readFileSync(join(album, "cover.webp"), "utf8"), "图片");
		assert.equal(readFileSync(original, "utf8"), "私有相册配置");
		await hook({ dir: pathToFileURL(`${output}/`) });
		await hook({ dir: pathToFileURL(`${join(root, "无相册")}/`) });
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});
