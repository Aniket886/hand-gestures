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
    const audioBase64 = String(body?.audioBase64 || "");
    const mimeType = String(body?.mimeType || "audio/webm");
    if (!audioBase64) {
      res.statusCode = 400;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ error: "Missing audio payload" }));
      return;
    }

    const audioBuffer = Buffer.from(audioBase64, "base64");
    const form = new FormData();
    form.append("model", "whisper-large-v3-turbo");
    form.append("language", "en");
    form.append(
      "prompt",
      "Transcribe spoken English with an Indian accent accurately. Preserve names and technical terms like Arc, ArcMotion, GitHub, Crunchyroll, Groq, MediaPipe, Jupiter, Mercury, Venus, Earth, Mars, and Solar System."
    );
    form.append(
      "file",
      new Blob([audioBuffer], { type: mimeType }),
      mimeType.includes("mp4") ? "arc-audio.m4a" : "arc-audio.webm"
    );

    const upstream = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: form,
    });

    if (!upstream.ok) {
      const text = await upstream.text().catch(() => "");
      res.statusCode = 502;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ error: "Groq transcription failed", status: upstream.status, detail: text.slice(0, 500) }));
      return;
    }

    const data = await upstream.json();
    const transcript = String(data?.text || "").trim();

    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ text: transcript }));
  } catch (error) {
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: "Server error", detail: String(error?.message || error) }));
  }
}
