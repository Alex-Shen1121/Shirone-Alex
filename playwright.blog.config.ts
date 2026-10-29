import { defineConfig } from "@playwright/test";
import themeConfig from "./playwright.config";

// 个人站点验收使用已启动的生产预览，避免与主题样例的开发服务器混用。
export default defineConfig({
	...themeConfig,
	testDir: "./tests/blog",
	webServer: undefined,
	use: {
		...themeConfig.use,
		baseURL: process.env.BLOG_PREVIEW_URL || "http://127.0.0.1:4322",
	},
});
