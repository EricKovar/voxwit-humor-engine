import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed",
    });
  }

  try {
    const {
      input_text,
      tone = "witty",
      max_outputs = 3,
      surface = "comment",
      platform = "linkedin",
    } = req.body;

    if (!input_text) {
      return res.status(400).json({
        error: "input_text is required",
      });
    }

    const prompt = `
You are VoxWit, a humor and engagement engine for social media writing.

Rewrite the following ${surface} for ${platform} into ${max_outputs} stronger, funnier, more engaging options.

Tone: ${tone}

Text:
${input_text}

Return valid JSON only. Do not use markdown. Do not wrap the response in code fences.

Use this exact shape:
{
  "options": [
    {
      "text": "rewritten post or comment",
      "score": 1-100,
      "hook_type": "contrast | curiosity | authority | punchline | analogy",
      "tone": "${tone}"
    }
  ]
}
`;

    const response = await client.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.9,
    });

    const raw = response.choices[0].message.content;

    let parsed;

    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = {
        options: [
          {
            text: raw,
            score: null,
            hook_type: "unknown",
            tone,
          },
        ],
      };
    }

    return res.status(200).json(parsed);
  } catch (error) {
    console.error("VoxWit error:", error);

    return res.status(500).json({
      error: "Humor Engine failed",
      detail: error.message,
    });
  }
}

