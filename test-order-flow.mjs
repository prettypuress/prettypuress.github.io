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

function calculateTotal({ basePrice = 0, selectedDesignPrice = 0, toeDesignPrice = 0, addOns = [] }) {
  return basePrice + selectedDesignPrice + toeDesignPrice + addOns.reduce((total, price) => total + price, 0);
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

test("press-on toe pricing and order fields exist", () => {
  assert.match(html, /Press-On Toe Pricing/);
  assert.match(html, /<option value="Press-On Toes">Press-On Toes<\/option>/);
  assert.match(html, /<option value="Both">Both<\/option>/);
  assert.match(html, /<option value="Luxury" data-price="50">Luxury - \$50\+<\/option>/);
});

test("toe sizing kit is separate from nail sizing kit", () => {
  assert.match(html, /Nail Sizing Kit - \$5/);
  assert.match(html, /Toe Nail Sizing Kit - \$5/);
});

test("toe only estimate uses toe design plus add-ons", () => {
  assert.equal(calculateTotal({
    toeDesignPrice: 35,
    addOns: [5, 8]
  }), 48);
});

test("both order estimate combines fingernails, toes, and add-ons once", () => {
  assert.equal(calculateTotal({
    basePrice: 45,
    selectedDesignPrice: 30,
    toeDesignPrice: 50,
    addOns: [5, 15]
  }), 145);
});

test("sizing supports toes and keeps coin method as a resource", () => {
  assert.match(html, /id="sizingType"/);
  assert.match(html, /<label for="sizingType"[^>]*>What sizing are you submitting\?<\/label>/);
  assert.match(html, /<option value="">Select Sizing Type<\/option>/);
  assert.match(html, /id="toeSizingFields"/);
  assert.match(html, /<summary>Sizing Resources<\/summary>/);
});
