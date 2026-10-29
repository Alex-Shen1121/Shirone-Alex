/** 从仓库内的公开主题基线恢复测试样例，不读取个人内容仓。 */
import { execFileSync } from "node:child_process";
import {
	mkdirSync,
	mkdtempSync,
	renameSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const baseline = "dd1b7826af653a6db5429d5a9860ebfd9843bd46";
const destination = join(root, ".theme-fixture");
const temporary = mkdtempSync(join(root, ".theme-fixture-"));

try {
	// CI 必须检出历史；固定基线防止样例随个人站点内容漂移。
	execFileSync("git", ["cat-file", "-e", `${baseline}^{commit}`], {
		cwd: root,
		stdio: "pipe",
	});
	for (const [paths, strip] of [
		[
			["src/content", "src/data", "src/assets/images", "src/assets/games"],
			true,
		],
		[
			[
				"public/images",
				"public/logo",
				"public/assets/music",
				"public/assets/projects",
				"public/assets/anime",
			],
			false,
		],
	]) {
		const archive = execFileSync("git", ["archive", baseline, ...paths], {
			cwd: root,
			maxBuffer: 80 * 1024 * 1024,
		});
		execFileSync(
			"tar",
			["-x", ...(strip ? ["--strip-components=1"] : []), "-C", temporary],
			{ input: archive },
		);
	}
	// 这些缓存由当前构建生成，不能作为外部内容覆盖。
	rmSync(join(temporary, "public/assets/anime/covers"), {
		recursive: true,
		force: true,
	});
	mkdirSync(join(temporary, "config"));
	writeFileSync(
		join(temporary, "config/site.yaml"),
		"site: https://blog.codingshen.top/\ntitle: Shirone\nsubtitle: A Material 3 anime blog\nlang: en\n",
	);
	writeFileSync(
		join(temporary, "README.md"),
		`# 主题测试样例\n\n从公开主题基线 ${baseline} 自动生成，保留仓库 MIT 许可证约定。不要编辑或发布此目录。\n`,
	);
	rmSync(destination, { recursive: true, force: true });
	renameSync(temporary, destination);
	console.log(
		`已准备独立主题样例：${resolve(destination)}\n运行主题回归时设置 CONTENT_DIR=.theme-fixture。`,
	);
} catch (error) {
	console.error(
		`准备主题样例失败：${error.message}\n请确认完整 Git 历史可用；CI checkout 需要 fetch-depth: 0。`,
	);
	process.exitCode = 1;
} finally {
	rmSync(temporary, { recursive: true, force: true });
}
