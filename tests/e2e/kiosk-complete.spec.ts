import { expect, test } from "@playwright/test";

test("customer can complete an intake with review participation", async ({ page }) => {
  await page.goto("/kiosk");
  await page.getByRole("button", { name: "촬영 접수하기" }).click();
  await page.getByRole("button", { name: /증명사진/ }).click();
  await page.getByRole("button", { name: /^기본 보정/ }).click();
  await page.getByRole("button", { name: "이 상품 선택" }).click();
  await page.getByRole("checkbox", { name: /리뷰에 참여할게요/ }).check();
  await page.getByRole("button", { name: /수령 시간 선택/ }).click();
  await page.getByRole("radio", { name: /빠른 수령/ }).check();
  await page.getByRole("button", { name: "접수 정보 입력" }).click();
  await page.getByPlaceholder("이름을 입력해 주세요").fill("김민지");
  await page.getByPlaceholder("01012345678").fill("01012345678");
  await page.getByRole("button", { name: "개인정보 확인" }).click();
  await page.getByRole("checkbox", { name: /개인정보 수집 및 이용/ }).check();
  await page.getByRole("button", { name: "접수 내용 확인" }).click();
  await expect(page.getByText("리뷰 참여")).toBeVisible();
  await expect(page.getByText("참여 · 수정 파일 제공")).toBeVisible();
  await expect(page.getByText("30,000원")).toBeVisible();
  await page.getByRole("button", { name: "접수 완료하기" }).click();
  await expect(page.getByRole("heading", { name: "접수가 완료됐어요" })).toBeVisible();
  await expect(page.getByText(/^A-\d{3}$/)).toBeVisible();
});


