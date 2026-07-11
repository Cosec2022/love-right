import { test, expect } from "@playwright/test";

const errors = (page) => {
  const messages = [];
  page.on("pageerror", (error) => messages.push(`pageerror: ${error.message}`));
  page.on("console", (message) => { if (message.type() === "error") messages.push(`console: ${message.text()}`); });
  return messages;
};

const waitForLibrary = (page) => expect(page.locator(".story-entry")).toHaveCount(10);

test("homepage launches with the published library, slogan and no errors", async ({ page }) => {
  const browserErrors = errors(page);
  await page.goto("/");
  await waitForLibrary(page);
  await expect(page.getByRole("heading", { name: /Love\s*Right/i })).toBeVisible();
  await expect(page.getByText("先经历一段爱情，再看清自己是谁。", { exact: true })).toBeVisible();
  await expect(page.getByText("你不是回答一份问卷", { exact: false })).toHaveCount(0);
  await expect(page.getByText("正在打开故事库……")).toHaveCount(0);
  expect(browserErrors).toEqual([]);
});

test("audience filters rerender cards without duplicates", async ({ page }) => {
  await page.goto("/");
  await waitForLibrary(page);
  await page.getByRole("button", { name: "女性向" }).click();
  await expect(page.locator(".story-entry")).toHaveCount(6);
  await page.getByRole("button", { name: "男性向" }).click();
  await expect(page.locator(".story-entry")).toHaveCount(4);
  await page.getByRole("button", { name: "全部" }).click();
  await waitForLibrary(page);
  await page.getByRole("button", { name: "女性向" }).click();
  await expect(page.locator(".story-entry")).toHaveCount(6);
});

test("content badges appear only in their card metadata", async ({ page }) => {
  await page.goto("/");
  await waitForLibrary(page);
  for (const title of ["婚礼前夜，他从雨里回来", "她爱上了闺蜜最不能原谅的人"]) {
    const card = page.locator(".story-entry", { has: page.getByRole("heading", { name: title }) });
    await expect(card.locator(".entry-meta").getByText("禁忌之恋", { exact: true })).toHaveCount(1);
  }
  const adult = page.locator(".story-entry", { has: page.getByRole("heading", { name: "请把门锁上" }) });
  await expect(adult.locator(".entry-meta").getByText("18+ 成人限定", { exact: true })).toHaveCount(1);
  await expect(page.locator(".library-hero").getByText(/禁忌之恋|18\+ 成人限定/)).toHaveCount(0);
});

test("stories open directly and library history remains usable", async ({ page }) => {
  const browserErrors = errors(page);
  await page.goto("/");
  await waitForLibrary(page);
  await page.getByRole("button", { name: /那年夏天，风替他说了喜欢/ }).click();
  await expect(page.locator("#startScreen.active #storyTitle")).toHaveText("那年夏天，风替他说了喜欢");
  await page.getByRole("button", { name: "故事库", exact: true }).click();
  await waitForLibrary(page);
  await page.goto("/?story=story-10");
  await expect(page.locator("#startScreen.active #storyTitle")).toHaveText("请把门锁上");
  await page.goBack();
  await waitForLibrary(page);
  await page.goForward();
  await expect(page.locator("#startScreen.active #storyTitle")).toHaveText("请把门锁上");
  expect(browserErrors).toEqual([]);
});

test("a slow old story response cannot replace a newer story", async ({ page }) => {
  await page.route("**/stories/story-08/story.json", async (route) => { await new Promise((resolve) => setTimeout(resolve, 700)); await route.continue(); });
  await page.goto("/");
  await waitForLibrary(page);
  await page.getByRole("button", { name: /婚礼前夜，他从雨里回来/ }).click();
  await page.getByRole("button", { name: /请把门锁上/ }).click();
  await expect(page.locator("#startScreen.active #storyTitle")).toHaveText("请把门锁上");
  await page.waitForTimeout(900);
  await expect(page.locator("#startScreen.active #storyTitle")).toHaveText("请把门锁上");
});

test("load failures reach an explicit error screen", async ({ page }) => {
  await page.route("**/stories/catalog.json", (route) => route.fulfill({ status: 500, body: "catalog failure" }));
  await page.goto("/");
  await expect(page.locator("#errorScreen.active")).toContainText("无法载入");
});

test("story package failures reach an explicit error screen", async ({ page }) => {
  await page.goto("/");
  await waitForLibrary(page);
  await page.route("**/stories/story-01/story.json", (route) => route.fulfill({ status: 500, body: "story failure" }));
  await page.getByRole("button", { name: /那年夏天，风替他说了喜欢/ }).click();
  await expect(page.locator("#errorScreen.active")).toContainText("无法载入");
  await page.getByRole("button", { name: "返回故事库", exact: true }).click();
  await waitForLibrary(page);
});

test("research mode shows sixteen numeric values without qualitative labels", async ({ page }) => {
  await page.goto("/?story=story-01");
  await expect(page.getByRole("button", { name: "走进故事" })).toBeVisible();
  await page.getByRole("button", { name: "走进故事" }).click();
  for (let index = 0; index < 18; index += 1) await page.locator(".option").first().click();
  const continueButton = page.getByRole("button", { name: "看看这段选择说明了什么" });
  if (await continueButton.isVisible()) await continueButton.click();
  await expect(page.locator("#resultScreen.active")).toBeVisible();
  await page.locator(".research-details summary").click();
  await expect(page.locator(".trait-pill")).toHaveCount(16);
  await expect(page.locator(".trait-pill strong")).toHaveText(Array(16).fill(/^[0-9]+$/));
  await expect(page.locator("#traitGrid")).not.toContainText(/[高中低]/);
});

test("mobile library has no horizontal overflow and Story 10 starts", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await waitForLibrary(page);
  expect(await page.locator("body").evaluate((body) => body.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByRole("button", { name: "女性向" }).click();
  await expect(page.locator(".story-entry")).toHaveCount(6);
  await page.getByRole("button", { name: "全部" }).click();
  await page.getByRole("button", { name: /请把门锁上/ }).click();
  await expect(page.locator("#startScreen.active #storyTitle")).toHaveText("请把门锁上");
});
