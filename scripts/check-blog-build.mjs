/** 验收本个人博客的实际生产产物；主题样例回归另用固定夹具。 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const dist = resolve(process.argv[2] || "dist");
const read = (file) => readFileSync(join(dist, file), "utf8");
const home = read("index.html");
assert.match(home, /<html[^>]*lang="zh-CN"/, "首页必须使用简体中文");
assert.match(home, /<title>蛋壳宇宙/, "首页站名不正确");
assert.match(home, /name="author" content="AlexShen"/, "作者署名不正确");
for (const page of ["", "about/", "projects/", "posts/hello-universe/"]) {
	const html = read(`${page}index.html`);
	assert.ok(
		html.includes(`rel="canonical" href="https://blog.codingshen.top/${page}"`),
		`页面缺少正确的规范链接：/${page}`,
	);
}
assert.ok(
	existsSync(join(dist, "pagefind/pagefind.js")),
	"缺少生产搜索索引入口",
);
assert.match(
	read("rss.xml"),
	/我是 AlexShen，在蛋壳宇宙记录技术与日常/,
	"RSS 未包含自我介绍文章",
);
assert.doesNotMatch(
	read("robots.txt"),
	/Disallow:\s*\/_astro\//,
	"不应阻止抓取页面渲染资源",
);
for (const page of ["draft", "markdown-fields"]) {
	assert.ok(
		!existsSync(join(dist, `posts/${page}/index.html`)),
		`草稿混入正式产物：${page}`,
	);
}
for (const page of [
	"friends",
	"moments",
	"anime",
	"compass",
	"albums",
	"skills",
	"timeline",
	"devices",
	"games",
	"series",
	"projects",
]) {
	const html = read(`${page}/index.html`);
	assert.doesNotMatch(
		html,
		/http-equiv="refresh"/i,
		`原有模块不能被关闭：${page}`,
	);
}
console.log(
	"个人博客生产验收通过：中文站名、署名、规范链接、搜索、订阅、草稿隔离和完整模块均正常。",
);
