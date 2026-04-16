require("dotenv").config({ override: true });

const express = require("express");
const OpenAI = require("openai");

const app = express();
app.use(express.json());

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

app.get("/health", (req, res) => {
  res.json({ ok: true });
});

app.post("/generate", async (req, res) => {
  try {
    const { input_text, task = "hook", tone = "witty", max_outputs = 3 } = req.body;

    if (!input_text || typeof input_text !== "string") {
      return res.status(400).json({
        ok: false,
        error: "input_text is required and must be a string"
      });
    }

    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are a humor engine that writes sharp, concise, funny hooks. Return plain text only."
        },
        {
          role: "user",
          content:
            `Task: ${task}\nTone: ${tone}\nMax outputs: ${max_outputs}\n\nWrite ${max_outputs} short humorous options for this:\n\n${input_text}`
        }
      ]
    });

    const output = response.choices?.[0]?.message?.content?.trim() || "";

    return res.json({
      ok: true,
      output
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: err.message || "Unknown server error"
    });
  }
});

app.listen(4000, () => {
  console.log("Humor Engine running on http://localhost:4000");
});
