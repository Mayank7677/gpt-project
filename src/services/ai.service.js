import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({});

async function generateResponse(content) {
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: content,
  });

  return response.text;
}

export default generateResponse;
