"use client";

import { useMemo } from "react";
import type { Address } from "viem";
import { formatUnits } from "viem";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  type ChartOptions,
} from "chart.js";
import { Line } from "react-chartjs-2";
import { usePriceHistory } from "@/hooks/usePriceHistory";
import { Loading } from "@/components/common/Loading";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip);

const GRID_COLOR = "rgba(38, 38, 47, 0.6)";
const MUTED_COLOR = "#9797a8";

const CHART_OPTIONS: ChartOptions<"line"> = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: "#1a1a24",
      borderColor: "#26262f",
      borderWidth: 1,
      titleColor: "#f5f5f7",
      bodyColor: "#f5f5f7",
      padding: 10,
      cornerRadius: 8,
      displayColors: false,
    },
  },
  scales: {
    x: {
      ticks: { maxTicksLimit: 6, color: MUTED_COLOR },
      grid: { color: GRID_COLOR },
      border: { color: GRID_COLOR },
    },
    y: {
      ticks: { callback: (value) => `$${value}`, color: MUTED_COLOR },
      grid: { color: GRID_COLOR },
      border: { display: false },
    },
  },
};

interface PriceChartProps {
  token: Address;
}

export function PriceChart({ token }: PriceChartProps) {
  const { priceHistory, isLoading } = usePriceHistory(token);

  const isUp =
    priceHistory.length >= 2 && priceHistory[priceHistory.length - 1].price >= priceHistory[0].price;
  const lineColor = isUp ? "#22c55e" : "#ef4444";

  const chartData = useMemo(
    () => ({
      labels: priceHistory.map((p) => new Date(p.timestamp).toLocaleDateString()),
      datasets: [
        {
          data: priceHistory.map((p) => Number(formatUnits(p.price, 6))),
          borderColor: lineColor,
          backgroundColor: isUp ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)",
          fill: true,
          tension: 0.3,
          borderWidth: 2,
          pointRadius: priceHistory.length > 30 ? 0 : 3,
          pointBackgroundColor: lineColor,
        },
      ],
    }),
    [priceHistory, lineColor, isUp]
  );

  if (isLoading) return <Loading label="Loading price history…" />;
  if (priceHistory.length < 2) {
    return (
      <div className="flex h-64 items-center justify-center rounded-2xl border border-border bg-surface">
        <p className="text-sm text-muted">No trades yet — chart will appear after the first buy.</p>
      </div>
    );
  }

  return (
    <div className="h-64 w-full rounded-2xl border border-border bg-surface p-4">
      <Line data={chartData} options={CHART_OPTIONS} />
    </div>
  );
}
