const VISION_MODEL = "@cf/meta/llama-3.2-11b-vision-instruct";
const TEXT_MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
const MAX_IMAGES = 3;
const MAX_IMAGE_BYTES = 10_000_000;
const ALLOWED_ORIGINS = new Set([
  "https://prettypuress.com",
  "https://www.prettypuress.com",
  "https://prettypuress.github.io",
  "http://localhost:8000",
  "http://127.0.0.1:8000"
]);

export const DESIGN_LEVELS = {
  Signature: {
    minimumFee: 15,
    maximumGuidance: 29,
    description: "Simple to moderate nail art, animal print, aura or airbrush effects, chrome, glitter, simple line work, limited embellishments, small simple charms or rhinestones, multiple designed nails, and no more than one French nail."
  },
  Luxury: {
    minimumFee: 30,
    maximumGuidance: 44,
    description: "More detailed or intricate artwork, multiple techniques, 2 or more French nails, moderate 3D work, more embellishments, layered designs, multiple statement nails, detailed patterns, and hand-painted work."
  },
  "Deluxe Freestyle": {
    minimumFee: 45,
    maximumGuidance: null,
    description: "Extensive sculpted 3D work, large or numerous statement charms, heavy dense embellishment, complex hand-painted art, character or portrait elements, sculptural elements, complex mixed media, and numerous advanced techniques throughout the set."
  }
};

const estimateSchema = {
  type: "object",
  properties: {
    level: {
      type: "string",
      enum: ["Signature", "Luxury", "Deluxe Freestyle"]
    },
    designFee: {
      type: "number",
      minimum: 15,
      maximum: 250
    },
    confidence: {
      type: "number",
      minimum: 0,
      maximum: 1
    },
    reason: {
      type: "string",
      minLength: 8,
      maxLength: 420
    }
  },
  required: ["level", "designFee", "confidence", "reason"]
};

function corsHeaders(request) {
  const origin = request.headers.get("Origin") || "";
  const allowOrigin = ALLOWED_ORIGINS.has(origin) ? origin : "https://prettypuress.com";

  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Vary": "Origin"
  };
}

function jsonResponse(request, body, status = 200) {
  return Response.json(body, {
    status,
    headers: corsHeaders(request)
  });
}

export function validateRequestBody(body) {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Request body must be JSON." };
  }

  const imageUrls = Array.isArray(body.imageUrls)
    ? body.imageUrls.map(url => String(url || "").trim()).filter(Boolean)
    : [];

  if (!imageUrls.length || imageUrls.length > MAX_IMAGES) {
    return { ok: false, error: "Upload 1 to 3 inspiration photos before analysis." };
  }

  const invalidUrl = imageUrls.find(url => {
    try {
      const parsed = new URL(url);
      return parsed.protocol !== "https:" || !parsed.hostname.endsWith("cloudinary.com");
    } catch {
      return true;
    }
  });

  if (invalidUrl) {
    return { ok: false, error: "Only secure Cloudinary inspiration image URLs can be analyzed." };
  }

  return {
    ok: true,
    value: {
      imageUrls,
      customerSelectedLevel: String(body.customerSelectedLevel || "").trim(),
      customerSelectedDesignFee: Number(body.customerSelectedDesignFee || 0),
      designDescription: String(body.designDescription || "").trim().slice(0, 1000),
      shape: String(body.shape || "").trim(),
      length: String(body.length || "").trim(),
      addOns: Array.isArray(body.addOns) ? body.addOns.map(addOn => String(addOn).trim()).filter(Boolean) : []
    }
  };
}

export function validateAiEstimate(data) {
  if (!data || typeof data !== "object") return null;

  const level = String(data.level || "").trim();
  const designFee = Number(data.designFee);
  const confidence = Number(data.confidence);
  const reason = String(data.reason || "").trim();

  if (!Object.prototype.hasOwnProperty.call(DESIGN_LEVELS, level)) return null;
  if (!Number.isFinite(designFee) || designFee < DESIGN_LEVELS[level].minimumFee || designFee > 250) return null;
  if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) return null;
  if (!reason) return null;

  return {
    level,
    designFee: Math.round(designFee),
    confidence: Math.round(confidence * 100) / 100,
    reason
  };
}

function extractModelText(response) {
  if (typeof response === "string") return response;
  if (!response || typeof response !== "object") return "";
  if (typeof response.response === "string") return response.response;
  if (typeof response.result === "string") return response.result;
  if (response.response && typeof response.response === "object") return JSON.stringify(response.response);
  return JSON.stringify(response);
}

export function extractStructuredEstimate(response) {
  if (response && typeof response.response === "object") {
    return response.response;
  }

  const text = extractModelText(response);
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;

  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}

async function imageUrlToDataUrl(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error("Unable to fetch inspiration image.");

  const contentType = response.headers.get("Content-Type") || "";
  if (!contentType.startsWith("image/")) throw new Error("Inspiration URL did not return an image.");

  const imageBuffer = await response.arrayBuffer();
  if (imageBuffer.byteLength > MAX_IMAGE_BYTES) throw new Error("Inspiration image is too large.");

  let binary = "";
  const bytes = new Uint8Array(imageBuffer);
  for (let index = 0; index < bytes.length; index += 1) {
    binary += String.fromCharCode(bytes[index]);
  }

  return `data:${contentType};base64,${btoa(binary)}`;
}

function buildVisionPrompt(imageNumber, orderContext) {
  return [
    "Analyze this Pretty Puress press-on nail inspiration photo for pricing.",
    "Describe the complete set, not just the most complex nail.",
    "Specifically note: French-tip count, hand-painted detail, aura or airbrush, chrome or metallic work, rhinestones, charms or hardware, 3D gel, sculpted elements, characters, portraits, mixed media, design density, and likely labor/material difficulty.",
    `This is inspiration photo ${imageNumber}.`,
    `Customer selected level: ${orderContext.customerSelectedLevel || "not selected"}.`,
    `Customer design description: ${orderContext.designDescription || "none provided"}.`
  ].join("\n");
}

function buildFinalPrompt(imageAnalyses, orderContext) {
  return [
    "You price custom press-on nail design fees for Pretty Puress.",
    "Make two separate decisions: the design level based on artistry, complexity, labor, materials, and technique; and the estimated design fee based on how difficult this specific design would be to recreate.",
    "Do not change level solely because the estimated price crosses a typical range. A complicated Luxury design may estimate slightly above $44 without automatically becoming Deluxe if the actual type of work is still Luxury-level. Deluxe has no price ceiling.",
    "Evaluate all uploaded photos together. If they show different complexity levels, base the estimate on the most complex design elements the customer appears to be requesting while considering the written design description.",
    "Do not automatically classify a set as Deluxe just because it contains a charm, rhinestones, chrome, or one 3D flower. Judge the overall set.",
    "Signature starts at $15 and is usually about $15-$29. It includes simple to moderate art, animal print, aura or airbrush, chrome/glitter, simple patterns or line work, limited embellishments, small/simple charms or rhinestones, and at most one French nail. If there are 2 or more French nails, classify as at least Luxury.",
    "Luxury starts at $30 and is usually about $30-$44. It includes more detailed artwork, multiple techniques, 2+ French nails, moderate 3D work, more embellishments, chains/charms/chrome, layered designs, multiple statement nails, detailed patterns, and hand-painted work. Luxury may contain 3D art and charms; those alone do not make a set Deluxe.",
    "Deluxe Freestyle starts at $45 with no maximum. It includes extensive sculpted 3D work, large or numerous statement charms, heavy embellishment, complex hand-painted art, character artwork, portrait/photo elements, highly customized or sculptural designs, complex mixed-media designs, numerous advanced techniques, or nails that function like separate art pieces.",
    `Customer selected level: ${orderContext.customerSelectedLevel || "not selected"}.`,
    `Customer selected design fee: ${orderContext.customerSelectedDesignFee || 0}.`,
    `Shape: ${orderContext.shape || "not selected"}.`,
    `Length: ${orderContext.length || "not selected"}.`,
    `Add-ons: ${orderContext.addOns.join(", ") || "none"}.`,
    `Customer design description: ${orderContext.designDescription || "none provided"}.`,
    "Image analyses:",
    imageAnalyses.map((analysis, index) => `Photo ${index + 1}: ${analysis}`).join("\n\n"),
    "Return only JSON matching the requested schema."
  ].join("\n");
}

async function analyzeImages(env, orderContext) {
  const analyses = [];

  for (let index = 0; index < orderContext.imageUrls.length; index += 1) {
    const image = await imageUrlToDataUrl(orderContext.imageUrls[index]);
    const response = await env.AI.run(VISION_MODEL, {
      messages: [
        { role: "system", content: "You are a precise nail-art production estimator." },
        { role: "user", content: buildVisionPrompt(index + 1, orderContext) }
      ],
      image,
      max_tokens: 700
    });

    analyses.push(extractModelText(response).slice(0, 1600));
  }

  return analyses;
}

async function estimateDesign(env, orderContext, imageAnalyses) {
  const response = await env.AI.run(TEXT_MODEL, {
    messages: [
      { role: "system", content: "You return concise, valid JSON for custom nail design estimates." },
      { role: "user", content: buildFinalPrompt(imageAnalyses, orderContext) }
    ],
    response_format: {
      type: "json_schema",
      json_schema: estimateSchema
    },
    max_tokens: 500
  });

  return validateAiEstimate(extractStructuredEstimate(response));
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(request)
      });
    }

    if (request.method !== "POST") {
      return jsonResponse(request, { error: "Method not allowed." }, 405);
    }

    if (!env.AI) {
      return jsonResponse(request, { error: "Workers AI binding is not configured." }, 500);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return jsonResponse(request, { error: "Request body must be valid JSON." }, 400);
    }

    const validatedRequest = validateRequestBody(body);
    if (!validatedRequest.ok) {
      return jsonResponse(request, { error: validatedRequest.error }, 400);
    }

    try {
      const imageAnalyses = await analyzeImages(env, validatedRequest.value);
      const estimate = await estimateDesign(env, validatedRequest.value, imageAnalyses);

      if (!estimate) {
        return jsonResponse(request, { error: "AI response could not be validated." }, 502);
      }

      return jsonResponse(request, estimate);
    } catch (error) {
      console.error("AI estimate failed:", error);
      return jsonResponse(request, { error: "AI analysis failed. Manual review required." }, 502);
    }
  }
};
