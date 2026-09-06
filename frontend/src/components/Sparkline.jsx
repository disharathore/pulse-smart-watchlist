import { LineChart, Line, ResponsiveContainer, YAxis } from 'recharts';

export default function Sparkline({ data, positive }) {
  if (!data || data.length < 2) {
    return <div className="h-9 flex items-center text-[11px] text-muted">Awaiting history...</div>;
  }

  const points = data.map((d) => ({ price: Number(d.price) }));

  return (
    <div className="h-9 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points}>
          <YAxis domain={['dataMin', 'dataMax']} hide />
          <Line
            type="monotone"
            dataKey="price"
            stroke={positive ? '#22c55e' : '#ef4444'}
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
