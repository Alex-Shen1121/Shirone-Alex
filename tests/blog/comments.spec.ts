import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

// 使用内容仓实际提供的 Twikoo SDK，只拦截服务端，避免测试留言写入正式评论区。
test.beforeEach(async ({ page }) => {
	await page.route("https://comments.codingshen.top/**", (route) => {
		const { event } = route.request().postDataJSON();
		return route.fulfill({
			json:
				event === "GET_CONFIG"
					? { config: { VERSION: "2.0.17", REQUIRED_FIELDS: "nick" } }
					: event === "COMMENT_SUBMIT"
						? { id: "test-comment" }
						: { data: [], count: 0, more: false },
		});
	});
});

for (const theme of ["light", "dark"]) {
	for (const width of [390, 1194, 1440]) {
		test(`${theme} / ${width}：评论字段对齐且标签具有浅色边框`, async ({
			page,
		}, testInfo) => {
			await page.addInitScript(
				(value) => localStorage.setItem("theme", value),
				theme,
			);
			await page.emulateMedia({ reducedMotion: "reduce" });
			await page.setViewportSize({ width, height: 900 });
			await page.goto("/friends/");
			for (const visit of ["直接打开", "站内跳转"]) {
				if (visit === "站内跳转") {
					await page.locator('#navbar a[href="/"]').first().click();
					await expect(page.locator("#comments")).toHaveCount(0);
					if (width < 1024) await page.locator("#nav-drawer-switch").click();
					await page
						.getByRole("link", { name: "友链", exact: true })
						.filter({ visible: true })
						.first()
						.click();
				}
				await page.locator("#comments").scrollIntoViewIfNeeded();
				await expect(
					page.getByRole("textbox", { name: "昵称", exact: true }),
				).toBeVisible();
				await page.waitForFunction(
					() =>
						getComputedStyle(document.documentElement)
							.getPropertyValue("--mc-primary")
							.trim()
							.startsWith("#") &&
						[...document.querySelectorAll(".onload-animation")].every(
							(node) =>
								(node as HTMLElement).offsetParent === null ||
								getComputedStyle(node).opacity === "1",
						),
				);
				expect(
					await page
						.locator("html")
						.evaluate((el) => el.classList.contains("dark")),
				).toBe(theme === "dark");
				const editor = await page.locator(".tk-input textarea").boundingBox();
				if (!editor) throw new Error("评论编辑框不可见");
				const fields = page.locator(".tk-meta-input > .tk-meta-input__item");
				const boxes = await fields.evaluateAll((nodes) =>
					nodes.map((node) => node.getBoundingClientRect().toJSON()),
				);
				expect(boxes).toHaveLength(3);
				expect(boxes[0].x).toBeCloseTo(editor.x, 0);
				expect(boxes[2].right).toBeCloseTo(editor.x + editor.width, 0);
				if (width >= 768) {
					expect(new Set(boxes.map((box) => box.y)).size).toBe(1);
					expect(boxes[1].x - boxes[0].right).toBeCloseTo(
						boxes[2].x - boxes[1].right,
						0,
					);
				} else {
					for (const box of boxes)
						expect(box.width).toBeCloseTo(editor.width, 0);
					expect(boxes[1].y - boxes[0].bottom).toBeCloseTo(
						boxes[2].y - boxes[1].bottom,
						0,
					);
					expect(boxes[1].y).toBeGreaterThan(boxes[0].bottom);
				}
				for (const field of await fields.all()) {
					const label = field.locator(".tk-input-group__prepend");
					await expect(label).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
					await expect(label).toHaveCSS("border-width", "1px");
					await expect(label).toHaveCSS("border-style", "solid");
					const labelBox = await label.boundingBox();
					const inputBox = await field.locator("input").boundingBox();
					if (!labelBox || !inputBox) throw new Error("评论字段不可见");
					expect(labelBox.y + labelBox.height / 2).toBeCloseTo(
						inputBox.y + inputBox.height / 2,
						0,
					);
					expect(labelBox.height).toBeLessThan(inputBox.height);
				}
				const result = await new AxeBuilder({ page })
					.include(".tk-meta-input")
					.withTags(["wcag2a", "wcag2aa", "wcag21aa"])
					.analyze();
				expect(result.violations).toEqual([]);
			}
			await page
				.locator("#comments")
				.screenshot({ path: testInfo.outputPath("comments.png") });
		});
	}
}

test("评论字段支持键盘输入、必填校验与提交", async ({ page }) => {
	await page.goto("/friends/");
	await page.locator("#comments").scrollIntoViewIfNeeded();
	const nickname = page.getByRole("textbox", { name: "昵称", exact: true });
	const email = page.getByRole("textbox", { name: "邮箱", exact: true });
	const website = page.getByRole("textbox", { name: "网址", exact: true });
	const editor = page.locator(".tk-input textarea");
	const send = page.locator(".tk-send");
	await expect(email).toHaveAttribute("placeholder", "选填");
	await expect(send).toBeDisabled();
	await editor.fill("评论样式验证");
	await expect(send).toBeDisabled();
	await nickname.fill("样式测试");
	await expect(send).toBeEnabled();
	await nickname.press("Tab");
	await expect(email).toBeFocused();
	await email.fill("test@example.com");
	await email.press("Tab");
	await expect(website).toBeFocused();
	await website.fill("https://example.com");
	const submission = page.waitForRequest(
		(request) =>
			request.url().startsWith("https://comments.codingshen.top") &&
			request.postDataJSON()?.event === "COMMENT_SUBMIT",
	);
	await send.click();
	expect((await submission).postDataJSON()).toMatchObject({
		nick: "样式测试",
		mail: "test@example.com",
		link: "https://example.com",
		markdown: "评论样式验证",
		url: "/friends/",
	});
	await expect(editor).toHaveValue("");
	await expect(send).toBeDisabled();
});
