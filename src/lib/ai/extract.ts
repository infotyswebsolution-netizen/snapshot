import Anthropic from "@anthropic-ai/sdk";
import { BILL_EXTRACTION_SYSTEM_PROMPT } from "./prompts";
import type { ExtractionResult } from "@/types/ai";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

const FALLBACK_RESULT: ExtractionResult = {
  supplier_name: null,
  invoice_date: null,
  invoice_number: null,
  total_amount: null,
  currency: null,
  confidence: 0,
  items: [],
  extraction_notes:
    "Could not read this image. Please enter items manually.",
};

export async function extractBillData(
  imageBase64: string,
  mediaType: "image/jpeg" | "image/png" | "image/webp" = "image/jpeg"
): Promise<{ success: boolean; extraction: ExtractionResult }> {
  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2048,
      system: BILL_EXTRACTION_SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mediaType,
                data: imageBase64,
              },
            },
            {
              type: "text",
              text: "Extract all items from this supplier invoice or delivery bill.",
            },
          ],
        },
      ],
    });
    // imageBase64 is no longer referenced after this point

    const rawText =
      response.content[0].type === "text" ? response.content[0].text : "";

    const cleanJson = rawText
      .replace(/^```json\s*/i, "")
      .replace(/\s*```$/, "")
      .trim();

    const extraction = JSON.parse(cleanJson) as ExtractionResult;

    if (!Array.isArray(extraction.items)) {
      throw new Error("items field missing or not array");
    }

    return { success: true, extraction };
  } catch {
    // Any failure → return safe fallback [I-4]
    return { success: false, extraction: FALLBACK_RESULT };
  }
}
