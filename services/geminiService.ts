import { GoogleGenAI } from "@google/genai";
import { Block } from "../types";

// Note: In a production environment, never expose keys on the client side.
// This is for the prototype requirement where we assume process.env.API_KEY is available.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

export const analyzeChain = async (blocks: Block[]): Promise<string> => {
  if (!process.env.API_KEY) {
    return "API Key not configured. AI Analysis unavailable.";
  }

  try {
    const dataSummary = blocks.map(b => ({
      index: b.header.index,
      timestamp: new Date(b.header.timestamp).toISOString(),
      transactions: b.transactions.map(t => ({
        product: t.productName,
        details: t.details,
        signer: t.signerPublicKey.substring(0, 10) + '...'
      }))
    }));

    const prompt = `
      Act as a Senior Supply Chain Auditor.
      Analyze the following blockchain ledger data for a supply chain system.
      
      Data:
      ${JSON.stringify(dataSummary, null, 2)}
      
      Please provide:
      1. A brief summary of the flow of goods.
      2. Any anomalies (e.g., unusual timestamps, missing steps if logical, repeated details).
      3. Sustainability assessment based on any "Carbon Footprint" or "Eco" details found.
      4. A final verification status (PASS/WARN/FAIL).

      Keep the response concise and formatted in Markdown.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    return response.text || "No analysis generated.";
  } catch (error) {
    console.error("Gemini Audit Error:", error);
    return "Failed to perform AI Audit. Please check console logs.";
  }
};
