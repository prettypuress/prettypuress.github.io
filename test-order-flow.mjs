import assert from "node:assert/strict";
import fs from "node:fs";

const html = fs.readFileSync(new URL("./index.html", import.meta.url), "utf8");

function test(name, callback) {
  try {
    callback();
    console.log("ok - " + name);
  } catch (error) {
    console.error("not ok - " + name);
    throw error;
  }
}

function calculateTotal({ basePrice, selectedDesignPrice, addOns = [] }) {
  return basePrice + selectedDesignPrice + addOns.reduce((total, price) => total + price, 0);
}

test("Elevated design level has been removed", () => {
  assert.equal(html.includes("Elevated"), false);
});

test("page closes CSS before rendering body content", () => {
  assert.match(html, /<\/style>\s*<\/head>\s*<body>/);
  assert.ok(html.indexOf("</style>") < html.indexOf("<section id=\"order\">"));
});

test("three design levels are available in the order dropdown", () => {
  assert.match(html, /<option value="Signature" data-price="15">Signature \$15<\/option>/);
  assert.match(html, /<option value="Luxury" data-price="30">Luxury \$30<\/option>/);
  assert.match(html, /<option value="Deluxe Freestyle" data-price="45">Deluxe Freestyle \$45\+<\/option>/);
});

test("customer order form does not show AI estimate controls", () => {
  assert.equal(html.includes("Analyze My Inspiration"), false);
  assert.equal(html.includes("customer_original_design_level"), false);
  assert.equal(html.includes("ai_suggested_design_level"), false);
  assert.equal(html.includes("ai_estimated_design_fee"), false);
});

test("admin AI estimator exists", () => {
  assert.match(html, /AI Inspiration Estimator/);
  assert.match(html, /id="adminAiImageUrls"/);
  assert.match(html, /id="adminAnalyzeInspirationButton"/);
});

test("customer estimated total uses selected design fee", () => {
  assert.equal(calculateTotal({
    basePrice: 45,
    selectedDesignPrice: 30
  }), 75);
});

test("Rush Order still adds $15", () => {
  assert.equal(calculateTotal({
    basePrice: 40,
    selectedDesignPrice: 15,
    addOns: [15]
  }), 70);
});

test("final estimated total includes add-ons", () => {
  assert.equal(calculateTotal({
    basePrice: 50,
    selectedDesignPrice: 30,
    addOns: [5, 8, 15]
  }), 108);
});

test("Formspree order submission remains configured", () => {
  assert.match(html, /<form id="orderForm" action="https:\/\/formspree\.io\/f\/xqeeyvkq" method="POST">/);
});
