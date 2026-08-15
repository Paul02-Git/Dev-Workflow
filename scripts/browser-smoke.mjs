import { chromium } from "playwright";

const BASE = "http://localhost:3000";

(async () => {
  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });

  console.log("1. Dashboard loads");
  await page.goto(`${BASE}/dashboard`);
  await page.waitForSelector("text=Dashboard");

  console.log("2. Create a client via the UI form");
  await page.goto(`${BASE}/clients`);
  await page.fill('input[name="name"]', "Browser Smoke Client");
  await page.fill('input[name="company"]', "Smoke Co");
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/clients\/.+/);
  console.log("   -> landed on", page.url());

  console.log("3. Start a new project for this client");
  await page.click('text=+ New project');
  await page.waitForURL(/\/projects\/new/);

  await page.selectOption('select[name="projectType"]', "WordPress Website");
  await page.fill('input[name="name"]', "Browser Smoke — WP Site");
  await page.check('input[value="wordpress"]');
  await page.check('input[value="elementor"]');
  await page.check('input[value="ga4"]');
  await page.check('input[value="gtm"]');
  await page.check('input[value="gsc"]');
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/projects\/[a-z0-9]+$/);
  console.log("   -> project created, landed on", page.url());

  console.log("4. Project detail page shows stages and tasks");
  await page.waitForSelector("text=Project health") || await page.waitForSelector("text=health");
  const bodyText = await page.textContent("body");
  console.log("   -> contains 'Access & Credentials':", bodyText.includes("Access & Credentials"));
  console.log("   -> contains 'Receive WordPress admin access':", bodyText.includes("Receive WordPress admin access"));

  console.log("5. Toggle a task status via the select");
  const selects = await page.$$("select");
  // skip the first selects if any belong to filters; find one with TODO option matching a known task row
  const firstTaskSelect = selects[0];
  await firstTaskSelect.selectOption("DONE");
  await page.waitForTimeout(800); // allow the server action + revalidate to settle

  console.log("6. Click Check Project");
  await page.click("text=Check Project");
  await page.waitForTimeout(500);
  const afterCheckText = await page.textContent("body");
  console.log("   -> shows result panel:", afterCheckText.includes("Potential issues") || afterCheckText.includes("No potential issues"));

  console.log("\nConsole/page errors captured:", errors.length);
  errors.slice(0, 10).forEach((e) => console.log("  ERROR:", e));

  await browser.close();
  console.log("\nBrowser smoke test complete.");
})();
