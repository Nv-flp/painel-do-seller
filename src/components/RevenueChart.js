"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const brlShort = new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 });

const shortDay = (day) => `${day.slice(8, 10)}/${day.slice(5, 7)}`;

function ChartTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return (
    <div className="chart-tooltip">
      <strong>{shortDay(row.day)}</strong>
      <span>{brl.format(row.revenue)}</span>
      <small>{row.orders} pedidos</small>
    </div>
  );
}

export default function RevenueChart({ data }) {
  return (
    <div className="chart" role="img" aria-label="Faturamento por dia nos últimos 30 dias">
      <ResponsiveContainer width="100%" height={260}>
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.28} />
              <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="var(--line)" vertical={false} />
          <XAxis dataKey="day" tickFormatter={shortDay} tick={{ fill: "var(--muted)", fontSize: 12 }} tickLine={false} axisLine={false} minTickGap={24} />
          <YAxis tickFormatter={(v) => `R$ ${brlShort.format(v)}`} tick={{ fill: "var(--muted)", fontSize: 12 }} tickLine={false} axisLine={false} width={84} />
          <Tooltip content={<ChartTooltip />} cursor={{ stroke: "var(--muted)", strokeDasharray: "3 3" }} />
          <Area type="monotone" dataKey="revenue" stroke="var(--accent)" strokeWidth={2} fill="url(#fill)" isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
