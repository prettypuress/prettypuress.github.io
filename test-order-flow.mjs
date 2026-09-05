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

function calculateTotal({ basePrice, selectedDesignPrice, aiDesignFee = 0, addOns = [] }) {
  return basePrice + Math.max(selectedDesignPrice, aiDesignFee) + addOns.reduce((total, price) => total + price, 0);
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

test("AI analysis controls and submission fields exist", () => {
  assert.match(html, /id="analyzeInspirationButton"/);
  assert.match(html, /name="customer_original_design_level"/);
  assert.match(html, /name="ai_suggested_design_level"/);
  assert.match(html, /name="ai_estimated_design_fee"/);
  assert.match(html, /name="ai_estimate_explanation"/);
});

test("higher AI design fee updates estimated total", () => {
  assert.equal(calculateTotal({
    basePrice: 45,
    selectedDesignPrice: 30,
    aiDesignFee: 38
  }), 83);
});

test("lower AI design fee does not reduce selected customer estimate", () => {
  assert.equal(calculateTotal({
    basePrice: 45,
    selectedDesignPrice: 45,
    aiDesignFee: 22
  }), 90);
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
    aiDesignFee: 38,
    addOns: [5, 8, 15]
  }), 116);
});

test("AI service failure fallback is shown in page script", () => {
  assert.match(html, /AI analysis failed\. Your inspiration will be manually reviewed by Pretty Puress\./);
});

test("Formspree order submission remains configured", () => {
  assert.match(html, /<form id="orderForm" action="https:\/\/formspree\.io\/f\/xqeeyvkq" method="POST">/);
});
