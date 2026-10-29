import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("所有原有模块保持可访问", async ({ request }) => {
	for (const route of [
		"/",
		"/friends/",
		"/moments/",
		"/anime/",
		"/compass/",
		"/albums/",
		"/skills/",
		"/timeline/",
		"/devices/",
		"/games/",
		"/series/",
		"/projects/",
	]) {
		const response = await request.get(route);
		expect(response.status(), route).toBe(200);
		expect(await response.text(), route).not.toMatch(/http-equiv="refresh"/i);
	}
});

test("手机搜索打开文章后收起面板，并更新标题与规范链接", async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await page.goto("/");
	await page.getByRole("button", { name: "搜索", exact: true }).click();
	await page.getByRole("searchbox", { name: "搜索" }).fill("蛋壳");
	await page
		.locator("#search-panel a")
		.filter({ hasText: "你好，蛋壳宇宙" })
		.click();
	await expect(page).toHaveURL(/\/posts\/hello-universe\//);
	await expect(page.getByRole("heading", { level: 1 })).toHaveText(
		"你好，蛋壳宇宙",
	);
	await expect(page.locator("#search-panel")).toHaveClass(/float-panel-closed/);
	await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
		"href",
		"https://blog.codingshen.top/posts/hello-universe/",
	);
	await page.getByRole("link", { name: "认识一下我", exact: true }).click();
	await expect(page).toHaveURL(/\/about\//);
	await expect(page.locator("#content-wrapper")).toContainText("AlexShen");
});

for (const width of [390, 768, 1440]) {
	test(`首页在 ${width} 像素宽度下完整显示品牌与原有导航`, async ({ page }) => {
		await page.setViewportSize({ width, height: 900 });
		await page.emulateMedia({ reducedMotion: "reduce" });
		await page.goto("/");
		await expect(page.getByRole("heading", { level: 1 })).toHaveText(
			"蛋壳宇宙",
		);
		await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
		expect(
			await page.evaluate(
				() => document.documentElement.scrollWidth <= window.innerWidth,
			),
		).toBe(true);
		if (width < 1024) await page.locator("#nav-drawer-switch").click();
		await expect(
			page
				.getByRole("link", { name: "相册", exact: true })
				.filter({ visible: true })
				.first(),
		).toBeVisible();
	});
}

for (const theme of ["light", "dark"]) {
	test(`${theme === "light" ? "浅色" : "深色"}模式的首页与文章无障碍检查`, async ({
		page,
	}) => {
		await page.addInitScript(
			(value) => localStorage.setItem("theme", value),
			theme,
		);
		await page.emulateMedia({ reducedMotion: "reduce" });
		for (const route of [
			"/",
			"/posts/hello-universe/",
			"/about/",
			"/projects/",
		]) {
			await page.goto(route);
			await page.waitForFunction(() =>
				[...document.querySelectorAll(".onload-animation")].every(
					(node) =>
						(node as HTMLElement).offsetParent === null ||
						getComputedStyle(node).opacity === "1",
				),
			);
			const result = await new AxeBuilder({ page })
				.withTags(["wcag2a", "wcag2aa", "wcag21aa"])
				.analyze();
			expect(
				result.violations.map(({ id, nodes }) => ({
					id,
					targets: nodes.map((node) => node.target),
				})),
				route,
			).toEqual([]);
		}
	});
}
