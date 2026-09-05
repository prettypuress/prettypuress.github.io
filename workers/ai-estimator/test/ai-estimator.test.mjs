import assert from "node:assert/strict";
import {
  extractStructuredEstimate,
  validateAiEstimate,
  validateRequestBody
} from "../src/index.js";

function test(name, callback) {
  try {
    callback();
    console.log("ok - " + name);
  } catch (error) {
    console.error("not ok - " + name);
    throw error;
  }
}

test("accepts Signature photo analysis", () => {
  assert.deepEqual(validateAiEstimate({
    level: "Signature",
    designFee: 22,
    confidence: 0.88,
    reason: "Simple aura, chrome, and limited line work across the set."
  }), {
    level: "Signature",
    designFee: 22,
    confidence: 0.88,
    reason: "Simple aura, chrome, and limited line work across the set."
  });
});

test("accepts 2+ French nails as at least Luxury", () => {
  assert.equal(validateAiEstimate({
    level: "Luxury",
    designFee: 34,
    confidence: 0.91,
    reason: "Two French nails plus layered chrome accents place the set in Luxury."
  }).level, "Luxury");
});

test("accepts Luxury estimates slightly above the typical range", () => {
  assert.equal(validateAiEstimate({
    level: "Luxury",
    designFee: 48,
    confidence: 0.82,
    reason: "Intricate but still moderate layered nail art without Deluxe sculptural density."
  }).designFee, 48);
});

test("accepts Deluxe $45+ analysis", () => {
  assert.equal(validateAiEstimate({
    level: "Deluxe Freestyle",
    designFee: 45,
    confidence: 0.87,
    reason: "Complex custom art and dense embellishment require Deluxe Freestyle."
  }).level, "Deluxe Freestyle");
});

test("accepts Deluxe estimate greater than $60", () => {
  assert.equal(validateAiEstimate({
    level: "Deluxe Freestyle",
    designFee: 72,
    confidence: 0.9,
    reason: "Extensive sculpted 3D work and numerous charms across the set."
  }).designFee, 72);
});

test("validates multiple uploaded Cloudinary photos", () => {
  const result = validateRequestBody({
    imageUrls: [
      "https://res.cloudinary.com/demo/image/upload/sample.jpg",
      "https://res.cloudinary.com/demo/image/upload/sample2.jpg"
    ],
    customerSelectedLevel: "Signature",
    designDescription: "Use the second photo for charms."
  });

  assert.equal(result.ok, true);
  assert.equal(result.value.imageUrls.length, 2);
});

test("rejects non-Cloudinary images", () => {
  const result = validateRequestBody({
    imageUrls: ["https://example.com/image.jpg"]
  });

  assert.equal(result.ok, false);
});

test("extracts JSON mode response objects", () => {
  assert.equal(extractStructuredEstimate({
    response: {
      level: "Luxury",
      designFee: 38,
      confidence: 0.91,
      reason: "Multiple detailed techniques and moderate embellishment are present."
    }
  }).designFee, 38);
});

test("extracts JSON from text fallback responses", () => {
  assert.equal(extractStructuredEstimate({
    response: "Here is the estimate: {\"level\":\"Deluxe Freestyle\",\"designFee\":68,\"confidence\":0.86,\"reason\":\"Dense sculpted art.\"}"
  }).level, "Deluxe Freestyle");
});
