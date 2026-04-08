export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.statusCode = 405;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: "Method not allowed" }));
    return;
  }

  try {
    const apiKey = process.env.GROQ_KEY;
    if (!apiKey) {
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ error: "Missing GROQ_KEY on server" }));
      return;
    }

    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const prompt = String(body?.prompt || "").trim();
    if (!prompt) {
      res.statusCode = 400;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ error: "Missing prompt" }));
      return;
    }

    const model = String(body?.model || "llama-3.1-8b-instant");

    const upstream = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.4,
        messages: [
          {
            role: "system",
            content:
              "You are Arc, a concise voice assistant inside a hand-gesture web app. Reply in 1-3 short sentences. Avoid markdown.",
          },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!upstream.ok) {
      const text = await upstream.text().catch(() => "");
      res.statusCode = 502;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ error: "Groq request failed", status: upstream.status, detail: text.slice(0, 500) }));
      return;
    }

    const data = await upstream.json();
    const content = String(data?.choices?.[0]?.message?.content || "").trim();

    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ text: content || "I didn't get an answer. Please try again." }));
  } catch (err) {
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: "Server error", detail: String(err?.message || err) }));
  }
}

