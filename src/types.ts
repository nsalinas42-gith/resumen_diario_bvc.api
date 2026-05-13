
export interface StockData {
  ticker: string;
  name: string;
  action: string;
  closeBs: number;
  changeBs: number;
  closeUsd: number;
  changeUsd: number;
}

export interface IndexData {
  name: string;
  points: number;
  change: number;
  history?: number[];
}

export interface MarketSummary {
  date: string;
  totalVolumeBs: number;
  totalVolumeUsd: number;
  dollarRate: number;
  topVolumeActions: { ticker: string; volume: number }[];
  topOperationsCount: { ticker: string; count: number }[];
}

export interface DashboardState {
  stocks: StockData[];
  indices: IndexData[];
  summary: MarketSummary | null;
}
