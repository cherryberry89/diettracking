// End-to-end walkthrough. Run against a dev server that points at
// e2e/fake-supabase.mjs (see README). Usage: node e2e/smoke.mjs [baseUrl] [screenshotDir]
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
import assert from "node:assert/strict";

const BASE = process.argv[2] ?? "http://localhost:3100";
const SHOTS = process.argv[3];
const email = `test-${Date.now()}@example.com`;

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
page.on("console", (m) => m.type() === "error" && errors.push(`console: ${m.text()}`));
const shot = async (name) => SHOTS && page.screenshot({ path: `${SHOTS}/${name}.png` });
const step = (s) => console.log(`✓ ${s}`);

// Sign up
await page.goto(`${BASE}/`);
await page.waitForURL("**/login");
await shot("01-login");
await page.getByRole("button", { name: "Create an account" }).click();
await page.getByLabel("Email").fill(email);
await page.getByLabel("Password").fill("correct-horse-battery");
await page.getByRole("button", { name: "Create account" }).click();
await page.waitForURL("**/onboarding");
step("sign up → onboarding");

// Onboarding in imperial: 5 ft 10 in, 176 lb, age 30, male
await page.getByRole("button", { name: "Continue" }).click();
await page.locator('p[role=alert]').waitFor();
await page.getByRole("radio", { name: "Imperial (ft, lb)" }).click();
await page.getByLabel("Height, feet").fill("5");
await page.getByLabel("Height, inches").fill("10");
await page.getByLabel("Weight").fill("176");
await page.getByLabel("Age").fill("30");
await page.getByRole("radio", { name: "Male", exact: true }).click();
const bmiText = await page.locator("text=Approximate BMI").locator("xpath=../..").innerText();
assert.match(bmiText, /25\.3/, `BMI should be 25.3, got: ${bmiText}`);
assert.match(bmiText, /Overweight/);
await shot("02-onboarding-about");
step("imperial input, BMI 25.3");
await page.getByRole("button", { name: "Continue" }).click();
await page.getByRole("radio", { name: /Moderately active/ }).click();
await page.getByRole("button", { name: "Continue" }).click();
assert.equal(await page.getByRole("radio", { name: /Pregnancy/ }).count(), 0, "pregnancy hidden for male");
await page.getByRole("radio", { name: /Body recomposition/ }).click();
await shot("03-onboarding-goal");
await page.getByRole("button", { name: "Continue" }).click();
// 79.83 kg, 177.8 cm: BMR 1764.6, x1.55 = 2735, x0.92 = 2516 → 2520; protein 160
assert.equal(await page.getByLabel("Calories").inputValue(), "2520");
assert.equal(await page.getByLabel("Protein").inputValue(), "160");
await shot("04-onboarding-targets");
step("targets 2520 kcal / 160 g protein");
await page.getByRole("button", { name: "Start tracking" }).click();
await page.waitForURL("**/today");
await page.getByText("Nothing logged yet today").waitFor();
await shot("05-today-empty");
step("dashboard empty state");

// Log by text
await page.getByRole("link", { name: "Log food", exact: true }).first().click();
await page.waitForURL("**/log**");
await page.getByLabel("What did you eat?").fill("For lunch I had 200g chicken breast, a cup of rice and a zorblax");
await page.getByRole("button", { name: "Send" }).click();
const card = page.getByRole("region", { name: "Suggested entry" });
await card.waitFor();
await card.getByText("Chicken breast").waitFor();
assert.match(await card.innerText(), /needs values/);
assert.equal(await card.getByRole("radio", { name: "Lunch" }).getAttribute("aria-checked"), "true");
// Fill in the unknown item (already expanded)
await card.getByLabel("kcal").fill("120");
await card.getByLabel("Protein").fill("4");
// Rescale the chicken: open it and change 200 → 100 g
await card.getByRole("button", { name: /^Chicken breast/ }).click();
await card.getByLabel("Amount").fill("100");
assert.equal(await card.getByLabel("kcal").inputValue(), "165");
await card.getByRole("button", { name: "Save Chicken breast as a favourite" }).click();
await shot("06-log-proposal");
await card.getByRole("button", { name: "Add to log" }).click();
await page.getByText(/Added 3 items to lunch · 493 kcal/).waitFor();
step("text logging with edit, rescale and favourite");

// Barcode by manual entry (Nutella)
await page.getByRole("button", { name: "Scan a barcode" }).click();
await page.getByLabel("Or type the barcode number").fill("3017620422003");
await shot("07-barcode-sheet");
await page.getByRole("button", { name: "Look up" }).click();
const bc = page.getByRole("region", { name: "Suggested entry" });
await bc.waitFor({ timeout: 20000 });
assert.match(await bc.innerText(), /Nutella/i);
await bc.getByRole("radio", { name: "Snack" }).click();
await bc.getByRole("button", { name: "Add to log" }).click();
await page.getByText(/Added Nutella.* to snacks/i).waitFor();
step("barcode lookup via Open Food Facts");

// Photo flow
await page.locator('input[type="file"]').setInputFiles({
  name: "meal.png",
  mimeType: "image/png",
  buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64"),
});
await page.getByText(/Photo saved/).waitFor();
await page.getByLabel("What did you eat?").fill("2 eggs and a banana");
await page.getByRole("button", { name: "Send" }).click();
const ph = page.getByRole("region", { name: "Suggested entry" });
await ph.getByText("Banana").waitFor();
await ph.getByRole("button", { name: "Add to log" }).click();
await page.getByText(/Added 2 items/).waitFor();
step("photo upload + description");

// Quick add chip, then undo
await page.getByRole("button", { name: /^Add Chicken breast/ }).click();
const logged = page.getByText(/Added Chicken breast to/);
await logged.waitFor();
await shot("08-log-chat");
await logged.locator("xpath=..").getByRole("button", { name: "Undo" }).click();
await page.getByText("Removed").waitFor();
step("quick add + undo");

// Dashboard totals, water, edit
await page.getByRole("link", { name: "Today" }).click();
const cal = page.getByRole("region", { name: "Calories" });
await cal.getByText(/\d/).first().waitFor();
const calText = await cal.innerText();
console.log("  calories card:", calText.replace(/\n+/g, " | "));
assert.equal(await cal.getByRole("progressbar").getAttribute("aria-valuemax"), "2520");
const consumed = Number(await cal.getByRole("progressbar").getAttribute("aria-valuenow"));
assert.ok(consumed > 493 && consumed < 1500, `consumed ${consumed}`);
await page.getByRole("button", { name: "+ 16 fl oz" }).click();
await page.getByRole("button", { name: "+ 8 fl oz" }).click();
await page.getByRole("region", { name: "Water" }).getByText("24 fl oz").waitFor();
await page.getByRole("region", { name: "Water" }).getByRole("button", { name: "Undo" }).click();
await page.getByRole("region", { name: "Water" }).getByText("16 fl oz").waitFor();
await shot("09-today");
await page.screenshot({ path: SHOTS ? `${SHOTS}/09-today-full.png` : undefined, fullPage: true });
await page.getByRole("button", { name: "Edit Banana" }).click();
await page.getByRole("dialog").getByLabel("Amount").fill("2");
await shot("10-edit-sheet");
await page.getByRole("dialog").getByRole("button", { name: "Save", exact: true }).click();
await page.getByRole("dialog").waitFor({ state: "hidden" });
const after = Number(await cal.getByRole("progressbar").getAttribute("aria-valuenow"));
assert.equal(after - consumed, 107, "second banana adds 107 kcal");
await page.getByRole("button", { name: "Edit Zorblax" }).click();
await page.getByRole("dialog").getByRole("button", { name: "Delete" }).click();
await page.getByRole("dialog").waitFor({ state: "hidden" });
await page.getByRole("button", { name: "Edit Zorblax" }).waitFor({ state: "detached" });
step("dashboard totals, water, edit, delete");

// Previous day is empty
await page.getByRole("button", { name: "Previous day" }).click();
await page.getByText("Nothing logged on this day").waitFor();
await page.getByRole("heading", { name: "Yesterday" }).waitFor();
step("date switcher");

// Trends + weigh-in
await page.getByRole("link", { name: "Trends" }).click();
await page.getByRole("region", { name: "Weight" }).getByText("176 lb").first().waitFor();
const d = new Date();
d.setDate(d.getDate() - 7);
const weekAgo = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
await page.getByLabel("Weight (lb)").fill("179.5");
await page.getByLabel("Date").fill(weekAgo);
await page.getByRole("button", { name: "Log weight" }).click();
await page.getByRole("region", { name: "Weight" }).getByText(/−3.5 lb since/).waitFor();
await page.getByRole("region", { name: "Weight" }).locator("svg.recharts-surface").waitFor();
await shot("11-trends");
await page.screenshot({ path: SHOTS ? `${SHOTS}/11-trends-full.png` : undefined, fullPage: true });
step("trends + weigh-in");

// Profile: switch to metric and pregnancy-free goal change
await page.getByRole("link", { name: "Profile" }).click();
await page.getByRole("radio", { name: "Metric (cm, kg)" }).click();
assert.equal(await page.getByRole("textbox", { name: "Height", exact: true }).inputValue(), "178");
assert.equal(await page.getByRole("textbox", { name: "Weight", exact: true }).inputValue(), "79.8");
await page.getByRole("radio", { name: /Maintenance/ }).click();
await page.getByRole("button", { name: "Use suggested" }).click();
await page.getByRole("button", { name: "Save changes" }).click();
await page.getByText("Saved", { exact: true }).waitFor();
await page.screenshot({ path: SHOTS ? `${SHOTS}/12-profile-full.png` : undefined, fullPage: true });
step("profile edit");

// Sign out and back in; data persists
await page.getByRole("button", { name: "Sign out" }).click();
await page.waitForURL("**/login");
await page.getByRole("heading", { name: "Sign in" }).waitFor();
assert.equal(await page.getByLabel("Password").inputValue(), "", "password is not kept after sign-out");
await page.getByLabel("Email").fill(email);
await page.getByLabel("Password").fill("wrong-password");
await page.getByRole("button", { name: "Sign in" }).click();
await page.locator("p[role=alert]").waitFor();
await page.getByLabel("Password").fill("correct-horse-battery");
await page.getByRole("button", { name: "Sign in" }).click();
await page.waitForURL("**/today");
await page.getByRole("button", { name: "Edit Banana" }).waitFor();
step("sign out / wrong password / sign in");

// Desktop + dark screenshots
if (SHOTS) {
  const desk = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2, colorScheme: "dark", storageState: await ctx.storageState() });
  const p2 = await desk.newPage();
  await p2.goto(`${BASE}/today`);
  await p2.getByRole("button", { name: "Edit Banana" }).waitFor();
  await p2.screenshot({ path: `${SHOTS}/13-desktop-dark-today.png` });
  await p2.goto(`${BASE}/trends`);
  await p2.getByRole("region", { name: "Weight" }).waitFor();
  await p2.waitForTimeout(500);
  await p2.screenshot({ path: `${SHOTS}/14-desktop-dark-trends.png` });
  await desk.close();
}

const real = errors.filter((e) => !/401|400 \(Bad Request\)|406/.test(e));
if (real.length) {
  console.log("Browser errors:\n" + real.join("\n"));
  process.exitCode = 1;
}
await browser.close();
console.log(process.exitCode ? "FAILED" : "ALL PASSED");
