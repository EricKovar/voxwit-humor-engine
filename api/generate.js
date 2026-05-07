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
      error: "Method not allowed"
    });
  }

  try {
    const {
      input_text,
      tone = "witty",
      max_outputs = 3
    } = req.body;

    if (!input_text) {
      return res.status(400).json({
        error: "input_text is required"
      });
    }

    const prompt = `
You are VoxWit, an elite humor and engagement engine.

Generate ${max_outputs} stronger, funnier, more engaging rewrites.

Tone: ${tone}

Original Text:
${input_text}

Return ONLY a JSON array of rewritten options.
`;

    const completion = await client.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.9
    });

    return res.status(200).json({
      result: completion.choices[0].message.content
    });

  } catch (error) {
    console.error("VoxWit Error:", error);

    return res.status(500).json({
      error: "Humor Engine failed",
      detail: error.message
    });
  }
}
