import { expect, test } from "@playwright/test";

test("development mode skips activation and opens the kiosk", async ({ page }) => {
  await page.goto("/activate");
  await expect(page).toHaveURL(/\/kiosk$/);
  await expect(page.getByRole("button", { name: "촬영 접수하기" })).toBeVisible();
});

test("registered device requires PIN on every staff entry and lock returns to kiosk", async ({ page }) => {
  await page.goto("/kiosk");
  await page.getByRole("button", { name: "순천사진관 나다움" }).click();
  await expect(page).toHaveURL(/\/staff$/);
  await expect(page.getByRole("heading", { name: "직원 화면 잠금" })).toBeVisible();

  for (let attempt = 0; attempt < 6; attempt += 1) {
    await page.getByLabel("매장 PIN").fill("9999");
    await page.getByRole("button", { name: "직원 화면 열기" }).click();
    await expect(page.getByText("PIN이 올바르지 않아요.")).toBeVisible();
  }

  await page.getByLabel("매장 PIN").fill("1234");
  await page.getByRole("button", { name: "직원 화면 열기" }).click();
  await expect(page.getByRole("heading", { name: "오늘의 접수" })).toBeVisible();
  await page.getByRole("button", { name: "화면 잠그기" }).click();
  await expect(page).toHaveURL(/\/kiosk$/);

  await page.getByRole("button", { name: "순천사진관 나다움" }).click();
  await expect(page.getByRole("heading", { name: "직원 화면 잠금" })).toBeVisible();
});
