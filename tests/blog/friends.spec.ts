import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("禁用脚本时仍可阅读友链资料与留言入口", async ({ browser }) => {
	const context = await browser.newContext({ javaScriptEnabled: false });
	const page = await context.newPage();
	await page.goto(
		`${process.env.BLOG_PREVIEW_URL || "http://127.0.0.1:4322"}/friends/`,
	);
	await expect(page.getByRole("heading", { level: 1 })).toHaveText(
		"友链与相遇",
	);
	await expect(page.locator(".friend-exchange")).toContainText(
		"https://blog.codingshen.top/rss.xml",
	);
	await expect(
		page.getByRole("link", { name: "在下方评论区申请友链", exact: true }),
	).toHaveAttribute("href", "#comments");
	await expect(page.locator(".friend-card")).toHaveCount(3);
	await expect(
		page.getByRole("heading", { name: "本站名片", exact: true }),
	).toHaveCSS("font-size", "22px");
	await context.close();
});

test("直接打开和站内跳转后都能复制名片与模板，筛选不丢失说明", async ({
	page,
	context,
}) => {
	await context.grantPermissions(["clipboard-read", "clipboard-write"]);
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto("/friends/");
	for (const visit of ["直接打开", "站内跳转"]) {
		if (visit === "站内跳转") {
			await page.locator('#navbar a[href="/"]').first().click();
			await expect(page).toHaveURL(/\/$/);
			await page.locator('#navbar a[href="/friends/"]').first().click();
			await expect(page).toHaveURL(/\/friends\//);
		}
		await page
			.getByRole("heading", { name: "本站名片", exact: true })
			.scrollIntoViewIfNeeded();
		await page
			.getByRole("button", { name: "复制站点链接", exact: true })
			.click();
		await expect
			.poll(() => page.evaluate(() => navigator.clipboard.readText()))
			.toBe("https://blog.codingshen.top/");
		await page
			.getByRole("button", { name: "复制全部资料", exact: true })
			.click();
		await expect
			.poll(() => page.evaluate(() => navigator.clipboard.readText()))
			.toContain(
				"站点名称：蛋壳宇宙\n作者：AlexShen\n站点链接：https://blog.codingshen.top/",
			);
		await page
			.getByRole("button", { name: "复制申请模板", exact: true })
			.click();
		await expect
			.poll(() => page.evaluate(() => navigator.clipboard.readText()))
			.toContain("站点名称：\n站点链接：\n站点简介：\n头像链接：");
		await page
			.getByRole("searchbox", { name: "搜索", exact: true })
			.fill("Astro");
		await expect(page.locator(".friend-card")).toHaveCount(1);
		await expect(page.locator("#exchange")).toHaveText("一起交换友链");
		await page.getByRole("searchbox", { name: "搜索", exact: true }).fill("");
	}
});

test("剪贴板不可用时可手动复制完整资料", async ({ page }) => {
	await page.addInitScript(() => {
		Object.defineProperty(navigator, "clipboard", {
			value: { writeText: () => Promise.reject(new Error("权限被拒绝")) },
		});
	});
	await page.goto("/friends/");
	await page
		.getByRole("heading", { name: "本站名片", exact: true })
		.scrollIntoViewIfNeeded();
	await page.getByRole("button", { name: "复制全部资料", exact: true }).click();
	const fallback = page.getByRole("textbox", { name: "请手动复制以下内容" });
	await expect(fallback).toBeFocused();
	await expect(fallback).toHaveValue(
		/站点名称：蛋壳宇宙[\s\S]*RSS 订阅：https:\/\/blog.codingshen.top\/rss.xml/,
	);
});

test("评论按需加载，站内往返后只挂载一个实例", async ({ page }) => {
	const scriptRequests: string[] = [];
	page.on("request", (request) => {
		if (request.url().endsWith("/vendor/twikoo/2.0.17/twikoo.min.js")) {
			scriptRequests.push(request.url());
		}
	});
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto("/friends/");
	expect(scriptRequests).toHaveLength(0);
	for (const visit of ["首次进入", "再次进入"]) {
		if (visit === "再次进入") {
			await page.locator('#navbar a[href="/"]').first().click();
			await expect(page.locator("#comments")).toHaveCount(0);
			await page.locator('#navbar a[href="/friends/"]').first().click();
		}
		await page
			.getByRole("link", { name: "在下方评论区申请友链", exact: true })
			.click();
		await expect(page.locator('#comments input[name="nick"]')).toHaveAttribute(
			"aria-label",
			"昵称",
		);
		await expect(page.locator("#twikoo")).toHaveCount(1);
		await expect(page.locator(".shirone-twikoo-wrapper")).toHaveAttribute(
			"data-twikoo-path",
			"/friends/",
		);
		expect(scriptRequests).toHaveLength(1);
	}
});

for (const theme of ["light", "dark"]) {
	test(`${theme === "light" ? "浅色" : "深色"}模式友链页在手机与桌面无溢出且通过无障碍检查`, async ({
		page,
	}) => {
		await page.addInitScript(
			(value) => localStorage.setItem("theme", value),
			theme,
		);
		await page.emulateMedia({ reducedMotion: "reduce" });
		for (const width of [390, 1440]) {
			await page.setViewportSize({ width, height: 900 });
			await page.goto("/friends/");
			const panels = page.locator(".friend-exchange__columns > section");
			const card = await panels.nth(0).boundingBox();
			const application = await panels.nth(1).boundingBox();
			expect(card).not.toBeNull();
			expect(application).not.toBeNull();
			if (card && application) {
				if (width === 1440) {
					expect(application.y).toBeCloseTo(card.y, 0);
					expect(application.x).toBeGreaterThan(card.x + card.width);
				} else {
					expect(application.y).toBeGreaterThanOrEqual(card.y + card.height);
				}
			}
			await page
				.getByRole("link", { name: "在下方评论区申请友链", exact: true })
				.click();
			await expect(
				page.locator('#comments input[name="nick"]'),
			).toHaveAttribute("aria-label", "昵称");
			await expect(
				page.locator('#comments input[name="mail"]'),
			).toHaveAttribute("placeholder", "选填");
			await page.waitForFunction(() =>
				getComputedStyle(document.documentElement)
					.getPropertyValue("--mc-primary")
					.trim()
					.startsWith("#"),
			);
			await page.waitForFunction(() =>
				[...document.querySelectorAll(".onload-animation")].every(
					(node) =>
						(node as HTMLElement).offsetParent === null ||
						getComputedStyle(node).opacity === "1",
				),
			);
			expect(
				await page.evaluate(() =>
					document.documentElement.classList.contains("dark"),
				),
			).toBe(theme === "dark");
			expect(
				await page.evaluate(
					() => document.documentElement.scrollWidth <= innerWidth,
				),
			).toBe(true);
			const result = await new AxeBuilder({ page })
				.withTags(["wcag2a", "wcag2aa", "wcag21aa"])
				.analyze();
			expect(
				result.violations.map(({ id, nodes }) => ({
					id,
					targets: nodes.map((node) => node.target),
				})),
			).toEqual([]);
		}
	});
}
