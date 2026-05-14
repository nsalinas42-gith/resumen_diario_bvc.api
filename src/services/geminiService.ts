import { GoogleGenAI, Type } from "@google/genai";
import { DashboardState } from "../types";

// Always use process.env.GEMINI_API_KEY for the Gemini API.
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export async function extractBVCDataFromPdf(pdfBase64: string): Promise<DashboardState> {
  const model = "gemini-3-flash-preview";
  
  const prompt = `Extract all the financial data from this PDF of a daily report from the Bolsa de Valores de Caracas (BVC). 
  Return the information in a precise JSON format. 
  
  Focus on:
  1. RENDIMIENTO PROMEDIO DE RENTA VARIABLE table (Ticker, Name, Close Bs, % Change Bs, Close $, % Change $).
  2. ÍNDICES BURSÁTILES (Name, Points, % Change).
  3. Market summary like Date, Total effective volume (Bs and USD), Dollar rate (SMC), and top transacted actions.
  
  Ensure numbers are parsed correctly (remove % and Bs signs). Use numbers, not strings, for financial values.`;

  const response = await ai.models.generateContent({
    model,
    contents: {
      parts: [
        {
          inlineData: {
            mimeType: "application/pdf",
            data: pdfBase64
          }
        },
        { text: prompt }
      ]
    },
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          stocks: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                ticker: { type: Type.STRING },
                name: { type: Type.STRING },
                closeBs: { type: Type.NUMBER },
                changeBs: { type: Type.NUMBER },
                closeUsd: { type: Type.NUMBER },
                changeUsd: { type: Type.NUMBER }
              },
              required: ["ticker", "name", "closeBs", "changeBs", "closeUsd", "changeUsd"]
            }
          },
          indices: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                points: { type: Type.NUMBER },
                change: { type: Type.NUMBER }
              },
              required: ["name", "points", "change"]
            }
          },
          summary: {
            type: Type.OBJECT,
            properties: {
              date: { type: Type.STRING },
              totalVolumeBs: { type: Type.NUMBER },
              totalVolumeUsd: { type: Type.NUMBER },
              dollarRate: { type: Type.NUMBER },
              topVolumeActions: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    ticker: { type: Type.STRING },
                    volume: { type: Type.NUMBER }
                  }
                }
              },
              topOperationsCount: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    ticker: { type: Type.STRING },
                    count: { type: Type.NUMBER }
                  }
                }
              }
            }
          }
        }
      }
    }
  });

  if (!response || !response.text) {
    throw new Error("No se pudo obtener respuesta de la IA");
  }

  try {
    const data = JSON.parse(response.text);
    return data as DashboardState;
  } catch (e) {
    console.error("Failed to parse Gemini response:", response.text);
    throw new Error("Error al procesar la respuesta de la IA");
  }
}
