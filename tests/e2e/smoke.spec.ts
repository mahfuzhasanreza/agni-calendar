import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

/** Waits until the analysis for the current area has rendered. */
async function waitForAnalysis(page: Page) {
  await expect(page.getByRole("heading", { name: "Burning calendar" })).toBeVisible();
  await expect(page.getByRole("img", { name: /heatmap of monthly/ })).toBeVisible();
}

test("explorer: preset area renders every panel from real data", async ({ page }) => {
  await page.goto("/");
  await waitForAnalysis(page);
  for (const name of [
    "This month vs history",
    "One record from two sensor families",
    "Fire season profile",
    "Annual totals and trend",
    "Download the evidence",
    "Live fires and alerts",
  ]) {
    await expect(page.getByText(name, { exact: true })).toBeVisible();
  }
  // FIRMS hand-over: the area's box in the west,south,east,north form FIRMS alerts accept.
  await expect(page.getByTestId("firms-bbox")).toHaveText(/^[\d.]+,[\d.]+,[\d.]+,[\d.]+$/);
  // Calendar table view has year rows with numbers.
  await page.getByText("Show the calendar as a table").click();
  await expect(page.getByRole("rowheader", { name: "2015" })).toBeVisible();
  // The headline readout compares raw and harmonized change across 2012.
  await expect(page.getByText(/Change from 2009–11 to 2012–14/)).toBeVisible();
});

test("explorer: the raw record morphs into the harmonized one, and replays", async ({ page }) => {
  await page.goto("/");
  await waitForAnalysis(page);
  const panel = page.getByText("One record from two sensor families", { exact: true });
  await panel.scrollIntoViewIfNeeded();
  await expect(page.getByText("Harmonized: the 2012 jump is gone.")).toBeVisible();
  await page.getByRole("button", { name: "Replay" }).click();
  await expect(page.getByText(/^Raw record: MODIS until 2011/)).toBeVisible();
  await expect(page.getByText("Harmonized: the 2012 jump is gone.")).toBeVisible();
});

test("explorer: reduced motion shows the final chart without the replay control", async ({
  browser,
}) => {
  const context = await browser.newContext({ reducedMotion: "reduce" });
  const page = await context.newPage();
  await page.goto("/");
  await waitForAnalysis(page);
  await expect(page.getByRole("button", { name: "Replay" })).toHaveCount(0);
  await context.close();
});

test("3D fire map: opens on demand, steps through years, has a table alternative", async ({
  page,
}) => {
  await page.goto("/?mode=raw");
  await waitForAnalysis(page);
  await page.getByRole("button", { name: "Open the 3D fire map" }).click();
  const slider = page.getByRole("slider");
  await expect(slider).toBeVisible();
  await expect(page.getByRole("application", { name: /3D map of raw hotspots/ })).toBeVisible();
  await slider.fill("10"); // 2001 + 10
  await expect(
    page.getByRole("application", { name: /3D map of raw hotspots per 0.1° cell in 2011/ }),
  ).toBeVisible();
  await expect(page.getByText("Raw · MODIS era (1 km pixels)")).toBeVisible();
  await slider.fill("11");
  await expect(page.getByText("Raw · VIIRS era (375 m pixels)")).toBeVisible();
  await page.getByText("Show the data as a table").last().click();
  await expect(
    page
      .getByRole("rowheader", { name: "2012" })
      .or(page.getByRole("cell", { name: "2012" }))
      .first(),
  ).toBeVisible();
});

test("anomaly card links to NASA Worldview for a day of the selected month", async ({ page }) => {
  await page.goto("/?preset=chittagong-hill-tracts&month=2024-03");
  await waitForAnalysis(page);
  const link = page.getByRole("link", { name: "Open 2024-03-15 in NASA Worldview" });
  await expect(link).toBeVisible();
  await page.getByRole("spinbutton", { name: /Day/ }).fill("2");
  const href = await page
    .getByRole("link", { name: "Open 2024-03-02 in NASA Worldview" })
    .getAttribute("href");
  expect(href).toMatch(/^https:\/\/worldview\.earthdata\.nasa\.gov\/\?p=geographic&v=/);
  expect(href).toContain("VIIRS_SNPP_Thermal_Anomalies_375m_All");
  expect(href).toMatch(/&t=2024-03-02-T00:00:00Z$/);
});

test("explorer: raw / harmonized toggle changes the units", async ({ page }) => {
  await page.goto("/");
  await waitForAnalysis(page);
  await expect(
    page.getByText("Monthly hotspots (VIIRS-equivalent), one row per year."),
  ).toBeVisible();
  await page.getByRole("button", { name: "Raw", exact: true }).click();
  await expect(page.getByText("Monthly hotspots (raw), one row per year.")).toBeVisible();
});

test("explorer: lat/lon + radius area", async ({ page }) => {
  await page.goto("/");
  await waitForAnalysis(page);
  await page.getByRole("tab", { name: "Lat / Lon" }).click();
  await page.getByLabel("Latitude (°N)").fill("22.65");
  await page.getByLabel("Longitude (°E)").fill("92.20");
  await page.getByLabel("Radius (km)").fill("20");
  await page.getByRole("button", { name: /Show area/ }).click();
  await expect(page.getByText(/20 km around 22\.650°N, 92\.200°E/).first()).toBeVisible();
  await waitForAnalysis(page);

  // Outside the loaded region → a clear message, no request.
  await page.getByLabel("Latitude (°N)").fill("-31.4");
  await page.getByRole("button", { name: /Show area/ }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "inside the loaded data region" }),
  ).toBeVisible();
});

test("shareable link restores area, mode and month", async ({ page }) => {
  await page.goto("/?preset=sundarbans&mode=raw&month=2020-03");
  await waitForAnalysis(page);
  await expect(page.getByText("Sundarbans (Bangladesh and India)").first()).toBeVisible();
  await expect(page.getByText("Monthly hotspots (raw), one row per year.")).toBeVisible();
  await expect(page.getByLabel("Month to compare")).toHaveValue("2020-03");
  // Changing the view updates the address bar.
  await page.getByRole("button", { name: "Harmonized", exact: true }).click();
  await expect(page).toHaveURL(/preset=sundarbans&month=2020-03$/);
});

test("exports: monthly series CSV downloads with the expected columns", async ({ page }) => {
  await page.goto("/");
  await waitForAnalysis(page);
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("link", { name: /Monthly harmonized series/ }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/^agni-monthly-chittagong-hill-tracts.*\.csv$/);
  const text = await (await download.createReadStream()).toArray();
  const csv = Buffer.concat(text).toString("utf8").trim().split("\n");
  expect(csv[0]).toMatch(/^month,harmonized_viirs_equivalent,harmonized_p10,harmonized_p90/);
  expect(csv.length).toBeGreaterThan(300);
});

test("exports: detections CSV from the tiles", async ({ request }) => {
  const res = await request.get(
    "/api/export/detections?preset=chittagong-hill-tracts&start=2014-01&end=2014-12",
  );
  expect(res.status()).toBe(200);
  const lines = (await res.text()).trim().split("\n");
  expect(lines[0]).toBe(
    "date,time_utc,lat,lon,sensor,satellite,confidence,conf_class,qualified,frp,brightness,bright_t31,daynight,type,source",
  );
  const data = lines.slice(1).filter((l) => !l.startsWith("#"));
  expect(data.length).toBeGreaterThan(10);
  expect(data.every((l) => l.startsWith("2014-"))).toBe(true);
  expect(lines.at(-1)).toMatch(/^# /); // FIRMS acknowledgement + caveats at the end
});

test("method page shows the live validation report", async ({ page }) => {
  await page.goto("/method");
  await expect(
    page.getByRole("heading", { name: "How Agni makes 25 years comparable" }),
  ).toBeVisible();
  await expect(page.getByText("Validation: leave one year out")).toBeVisible();
  await expect(page.getByText(/\(selected\)/)).toBeVisible();
  await expect(page.getByRole("img", { name: /Held-out validation/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Data, citations and caveats" })).toBeVisible();
  await expect(page.getByRole("link", { name: "doi:10.1016/j.rse.2013.12.008" })).toBeVisible();
});

test("accessibility: no serious or critical axe violations @phone", async ({ page }) => {
  for (const path of ["/", "/method"]) {
    await page.goto(path);
    if (path === "/") await waitForAnalysis(page);
    else await expect(page.getByText("Validation: leave one year out")).toBeVisible();
    const results = await new AxeBuilder({ page })
      .exclude(".maplibregl-canvas") // the map canvas itself; all map functions have form alternatives
      .analyze();
    const serious = results.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical",
    );
    expect(
      serious.map((v) => `${v.id}: ${v.nodes.length} × ${v.help}`),
      `${path} has accessibility problems`,
    ).toEqual([]);
  }
});

test("layout: no horizontal scrolling on a phone @phone", async ({ page }) => {
  await page.goto("/");
  await waitForAnalysis(page);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});
