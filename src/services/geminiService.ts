import { GoogleGenAI, Type } from "@google/genai";
import { DashboardState } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export async function extractBVCData(base64Images: string[]): Promise<DashboardState> {
  const model = "gemini-3-flash-preview";
  
  const prompt = `Extract all the financial data from these screenshots of a daily report from the Bolsa de Valores de Caracas (BVC). 
  Return the information in a precise JSON format. 
  
  Focus on:
  1. RENDIMIENTO PROMEDIO DE RENTA VARIABLE table (Ticker, Name, Close Bs, % Change Bs, Close $, % Change $).
  2. ÍNDICES BURSÁTILES (Name, Points, % Change).
  3. Market summary like Date, Total effective volume (Bs and USD), Dollar rate (SMC), and top transacted actions.
  
  Ensure numbers are parsed correctly (remove % and Bs signs).`;

  const response = await ai.models.generateContent({
    model,
    contents: {
      parts: [
        ...base64Images.map(img => ({
          inlineData: {
            mimeType: "image/png",
            data: img.split(',')[1] || img
          }
        })),
        { text: prompt }
      ]
    },
    config: {
      responseMimeType: "application/json",
      responseSchema: SCHEMA
    }
  });

  return JSON.parse(response.text) as DashboardState;
}

export async function extractBVCDataFromPdf(pdfBase64: string): Promise<DashboardState> {
  const model = "gemini-3-flash-preview";
  
  const prompt = `Extract all the financial data from this PDF of a daily report from the Bolsa de Valores de Caracas (BVC). 
  Return the information in a precise JSON format. 
  
  Focus on:
  1. RENDIMIENTO PROMEDIO DE RENTA VARIABLE table (Ticker, Name, Close Bs, % Change Bs, Close $, % Change $).
  2. ÍNDICES BURSÁTILES (Name, Points, % Change).
  3. Market summary like Date, Total effective volume (Bs and USD), Dollar rate (SMC), and top transacted actions.
  
  Ensure numbers are parsed correctly (remove % and Bs signs).`;

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
      responseSchema: SCHEMA
    }
  });

  return JSON.parse(response.text) as DashboardState;
}

const SCHEMA = {
  type: Type.OBJECT,
  properties: {
    stocks: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          ticker: { type: Type.STRING },
          name: { type: Type.STRING },
          action: { type: Type.STRING },
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
};

export const INITIAL_DATA: DashboardState = {
  stocks: [
    { ticker: "ABC.A", name: "Banco del Caribe", action: "ACCION", closeBs: 1590.00, changeBs: 0.00, closeUsd: 3.1490, changeUsd: -0.88 },
    { ticker: "ALZ.B", name: "ALALZA Inversiones, C.A. B", action: "ACCION", closeBs: 37.00, changeBs: 0.00, closeUsd: 0.0733, changeUsd: -0.88 },
    { ticker: "ARC.A", name: "ARCA, Inmuebles y Valores A", action: "ACCION", closeBs: 2000.00, changeBs: 0.00, closeUsd: 3.9611, changeUsd: -0.88 },
    { ticker: "BVCC", name: "Bolsa de Valores de Caracas", action: "ACCION", closeBs: 789.99, changeBs: 16.39, closeUsd: 1.5646, changeUsd: 15.36 },
    { ticker: "BVL", name: "Banco de Venezuela", action: "ACCION", closeBs: 1650.00, changeBs: -6.52, closeUsd: 3.2679, changeUsd: -7.34 },
    { ticker: "BNC", name: "Banco Nacional de Credito", action: "ACCION", closeBs: 1380.00, changeBs: 0.73, closeUsd: 2.7331, changeUsd: -0.16 },
    { ticker: "CRM.A", name: "Corimon", action: "ACCION", closeBs: 579.00, changeBs: 0.00, closeUsd: 1.1467, changeUsd: -0.88 },
  ],
  indices: [
    { name: "Industrial", points: 2166.68, change: -0.31, history: [2200, 2180, 2190, 2170, 2175, 2166] },
    { name: "Financiero", points: 10907.64, change: -1.25, history: [11200, 11100, 11150, 11000, 10950, 10907] },
    { name: "IBC", points: 5625.33, change: -1.07, history: [5800, 5750, 5700, 5720, 5680, 5625] },
    { name: "Rendivalores", points: 20477.06, change: 0.82, history: [20100, 20200, 20150, 20300, 20400, 20477] },
  ],
  summary: {
    date: "12 de mayo del 2026",
    totalVolumeBs: 1706982681.50,
    totalVolumeUsd: 3380735.44,
    dollarRate: 504.9146,
    topVolumeActions: [
      { ticker: "RST", volume: 1614562577 },
      { ticker: "BVCC", volume: 35033843 },
      { ticker: "MPA", volume: 13927182 },
    ],
    topOperationsCount: [
      { ticker: "BPV", count: 298 },
      { ticker: "TPG", count: 291 },
      { ticker: "BVCC", count: 204 },
    ]
  }
};
