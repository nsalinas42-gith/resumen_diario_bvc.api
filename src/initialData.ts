import { DashboardState } from "./types";

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
  },
  lastUpdated: new Date().toISOString()
};
