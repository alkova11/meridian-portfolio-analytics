import { test, expect } from "@playwright/test";

test("reference layout, aligned local inspection, scenario, import preview and export", async ({
  page,
}) => {
  let simulations = 0;
  page.on("request", (r) => {
    if (r.url().includes("simulation-runs")) simulations++;
  });
  await page.goto("/");
  await expect(page.getByText("NET PORTFOLIO VALUE")).toBeVisible();
  await expect(page.getByText("10,000 paths · 252 trading days")).toBeVisible({
    timeout: 60000,
  });
  await expect(page.getByRole("heading", { name: /^RISK / })).toBeVisible();
  await expect(
    page.getByRole("img", { name: /^Pearson correlation heatmap/ }),
  ).toBeVisible();
  await page.getByText("View correlation data", { exact: true }).click();
  await expect(page.locator(".correlation-table-wrap table")).toBeVisible();
  const exportLink = page.locator(".header-history a");
  const exportUrl = (await exportLink.getAttribute("href"))!;
  const response = await page.request.get(exportUrl);
  expect(response.ok()).toBeTruthy();
  const saved = (await response.json()).run;
  const fan = page.getByRole("application", {
    name: "fan chart; use arrow keys to inspect dates",
  });
  const terminal = await page.locator(".terminal-panel dl").innerText();
  await fan.focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.locator(".chart-tooltip")).toContainText(
    "Simulation day 1",
  );
  const box = (await fan.boundingBox())!;
  const euro = (v: number) =>
    new Intl.NumberFormat("en-IE", {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 0,
    }).format(v);
  for (const fraction of [0, 0.5, 1]) {
    const index = Math.round(fraction * 252);
    await page.mouse.move(
      box.x + 48 + (box.width - 60) * fraction,
      box.y + 100,
    );
    const tooltip = page.locator(".chart-tooltip");
    await expect(tooltip).toContainText(`Simulation day ${index}`);
    await expect(tooltip).toContainText(saved.result.dates[index]);
    for (const quantile of saved.result.quantiles)
      await expect(tooltip).toContainText(euro(quantile[index]));
    expect(await fan.locator(".marker").count()).toBe(5);
    const bounds = (await tooltip.boundingBox())!;
    expect(bounds.x).toBeGreaterThanOrEqual(box.x);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(box.x + box.width);
    expect(bounds.y).toBeGreaterThanOrEqual(box.y);
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(box.y + box.height);
    expect(await page.locator(".terminal-panel dl").innerText()).toBe(terminal);
  }
  expect(simulations).toBe(1);
  await page.screenshot({
    path: "../reports/figures/dashboard-fan-hover.png",
    fullPage: true,
  });
  await page.mouse.move(0, 0);
  await expect(page.locator(".chart-tooltip")).toHaveCount(0);
  const drawdown = page.getByRole("application", {
    name: "drawdown chart; use arrow keys to inspect dates",
  });
  const db = (await drawdown.boundingBox())!;
  await page.mouse.move(db.x + db.width / 2, db.y + 80);
  await expect(drawdown.locator(".hguide")).toHaveCount(1);
  await expect(drawdown.locator(".vguide")).toHaveCount(1);
  await expect(drawdown.locator(".marker")).toHaveCount(1);
  await page.mouse.move(0, 0);
  await expect(page.locator(".drawdown-readout")).toContainText("CURRENT");
  await page.screenshot({
    path: "../reports/figures/dashboard-desktop.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Scenarios", exact: true }).click();
  await page.getByRole("button", { name: "Calculate scenario" }).click();
  await expect(page.locator(".scenario-result")).toBeVisible();
  await page.getByRole("button", { name: "Transactions", exact: true }).click();
  await page.getByLabel("Transaction CSV").setInputFiles({
    name: "deposit.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(
      "date,kind,symbol,quantity,price,cash_amount,fee,currency\n2026-10-23,DEPOSIT,,0,0,1000,0,EUR",
    ),
  });
  await expect(
    page.getByText("Ledger validation passed.", { exact: false }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Reference draft ↗", exact: true })
    .click();
  await expect(page.locator(".portfolio-header")).toBeVisible();
  await expect(page.locator(".dashboard-builder")).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: /^CORRELATION / }),
  ).toBeVisible();
});

test("dashboard choices persist while the reference draft stays fixed", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Customize layout" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Customize layout" }).click();
  await page
    .getByRole("button", { name: "Remove Drawdown", exact: true })
    .click();
  await expect(page.locator(".widget-drawdown")).toHaveCount(0);
  await page.getByLabel("Style of Performance").selectOption("area");
  await page.getByLabel("Width of Performance").selectOption("6");
  await page.getByRole("button", { name: "+ Add chart", exact: true }).click();
  await page.getByRole("button", { name: /Daily return distribution/ }).click();
  await expect(page.locator(".widget-returns")).toBeVisible();
  await page.reload();
  await expect(page.locator(".widget-drawdown")).toHaveCount(0);
  await expect(page.locator(".widget-returns")).toBeVisible();
  await page.getByRole("button", { name: "Customize layout" }).click();
  await expect(page.getByLabel("Style of Performance")).toHaveValue("area");
  await expect(page.getByLabel("Width of Performance")).toHaveValue("6");
  await page
    .getByRole("link", { name: "Reference draft ↗", exact: true })
    .click();
  await expect(page.locator(".drawdown-panel")).toBeVisible();
  await expect(page.locator(".dashboard-builder")).toHaveCount(0);
});
