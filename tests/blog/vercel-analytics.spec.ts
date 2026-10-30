import { expect, test } from "@playwright/test";

test("统计脚本在 Swup 跳转与前进后退中只加载一次", async ({ page }) => {
	let scriptRequests = 0;
	// 只验证脚本加载生命周期，避免测试流量进入真实统计。
	await page.route("**/_vercel/insights/script.js", (route) => {
		scriptRequests++;
		return route.fulfill({
			contentType: "application/javascript",
			body: "/* 统计服务替身 */",
		});
	});
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto("/");
	await expect.poll(() => scriptRequests).toBe(1);
	await page.waitForFunction(() => Boolean(window.swup));
	const originalDocument = await page.evaluateHandle(() => document);
	await page
		.locator('#content-wrapper a[href="/posts/hello-universe/"]')
		.first()
		.click();
	await expect(page.getByRole("heading", { level: 1 })).toHaveText(
		"我是 AlexShen，在蛋壳宇宙记录技术与日常",
	);
	await page.getByRole("link", { name: "文章归档", exact: true }).click();
	await expect(page).toHaveURL(/\/archive\//);
	await page.goBack();
	await expect(page).toHaveURL(/\/posts\/hello-universe\//);
	await page.goForward();
	await expect(page).toHaveURL(/\/archive\//);
	await expect(page.locator("#content-wrapper")).toContainText(
		"我是 AlexShen，在蛋壳宇宙记录技术与日常",
	);
	expect(await originalDocument.evaluate((value) => value === document)).toBe(
		true,
	);
	expect(scriptRequests).toBe(1);
	await expect(
		page.locator('script[src="/_vercel/insights/script.js"]'),
	).toHaveCount(1);
});
