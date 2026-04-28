import Groq from "groq-sdk";
const client = new Groq({ apiKey: process.env.GROQ_API_KEY });

export async function callLLM(prompt, systemPrompt = "") {
  const res = await client.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [
      { role: "system", content: systemPrompt || "You are a senior DevOps engineer." },
      { role: "user", content: prompt }
    ],
    max_tokens: 512,
  });
  return res.choices[0].message.content;
}