// src/lib/openaiDetect.ts
// AI text detection using HuggingFace Inference API (free, no billing required).
// Uses the "roberta-base-openai-detector" model — purpose-built to detect AI-generated text.
// Get a free token at: https://huggingface.co/settings/tokens
// Set VITE_HUGGINGFACE_TOKEN in your .env file (optional but avoids rate limits).

const AI_PHRASES = [
  "as an ai", "as an ai language model", "i am an ai",
  "delve into", "it is important to note", "it's important to note",
  "in conclusion,", "to summarize,", "in summary,",
  "furthermore,", "moreover,", "it is worth noting",
  "foster a positive", "fostering a positive",
  "i am committed to", "i am dedicated to",
  "upholding the rules with professionalism", "conflict resolution strategies",
  "i would like to express", "certainly!", "absolutely!",
  "i strive to", "i endeavor to", "with that being said,",
  "proactive approach", "ensuring a safe", "ensuring a positive",
  "i am well-versed", "i am passionate about", "i am eager to",
  "my commitment to", "i firmly believe", "i strongly believe",
  "rest assured", "i look forward to", "i am excited about the opportunity",
  "thank you for considering",
];

function localAIScore(text: string): number {
  const lower = text.toLowerCase();
  let score = 0;
  for (const phrase of AI_PHRASES) {
    if (lower.includes(phrase)) score++;
  }
  return score;
}

export async function detectAI(text: string): Promise<boolean> {
  const hfToken = import.meta.env.VITE_HUGGINGFACE_TOKEN;

  // --- Try HuggingFace roberta-base-openai-detector ---
  try {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (hfToken) headers["Authorization"] = `Bearer ${hfToken}`;

    // The model only accepts up to 512 tokens, so truncate if needed
    const truncated = text.length > 1500 ? text.slice(0, 1500) : text;

    const response = await fetch(
      "https://api-inference.huggingface.co/models/roberta-base-openai-detector",
      {
        method: "POST",
        headers,
        body: JSON.stringify({ inputs: truncated }),
      }
    );

    if (response.ok) {
      const data = await response.json();
      console.log("[AI Detection] HuggingFace response:", data);
      // Response format: [[{ label: "Real"/"Fake", score: 0.9 }, ...]]
      const results: { label: string; score: number }[] = Array.isArray(data[0]) ? data[0] : data;
      const fakeEntry = results.find((r) => r.label === "Fake");
      if (fakeEntry) {
        console.log(`[AI Detection] AI probability: ${(fakeEntry.score * 100).toFixed(1)}%`);
        return fakeEntry.score >= 0.7; // 70%+ confidence = AI-generated
      }
    } else {
      const errText = await response.text().catch(() => "");
      console.warn("[AI Detection] HuggingFace unavailable, using local fallback:", errText);
    }
  } catch (e) {
    console.warn("[AI Detection] HuggingFace error, using local fallback:", e);
  }

  // --- Fallback: local phrase heuristic ---
  const score = localAIScore(text);
  console.log(`[AI Detection] Local heuristic score: ${score}/2`);
  return score >= 2;
}
