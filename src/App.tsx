import { useEffect, useState } from "react";
import { Line, LineChart, XAxis, YAxis } from "recharts";
import { Data, useForecast } from "./useForecast";
import { useProduction } from "./useProduction";

const formatter = new Intl.DateTimeFormat("en-US", {
  weekday: "narrow",
});
const dayFormatter = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
});

const formatKw = (value: number) => `${Math.round(value / 1000)}kW`;
const formatCurrency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
}).format;

function App() {
  const { forecast, days, api, maxWatts, maxWattHours } = useForecast();
  const production = useProduction();

  const [, setUpdater] = useState(0);

  useEffect(() => {
    const update = () => setUpdater((i) => i + 1);
    window.addEventListener("orientationchange", update);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("orientationchange", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  if (!forecast && !days && !production) return <div>Loading...</div>;

  const totalValue =
    production?.reduce((sum: number, p) => sum + p.total ?? 0, 0) ?? 0;
  const daysForValue =
    production?.reduce((s: number, p) => (p.total > 0 ? s + 1 : s), 0) ?? 0;
  const perDay = daysForValue > 0 ? totalValue / daysForValue : 0;

  const totalProduction = formatKw(
    production?.reduce((sum: number, p) => sum + p.productionNum ?? 0, 0) ?? 0
  );

  const productionWithTimes: Data[] | undefined = production?.flatMap((p) => {
    return p.productionData.map((d, i) => {
      return {
        watts: (d ?? 0) * 4,
        date: new Date(p.startTime + i * 15 * 60 * 1000),
      };
    });
  });

  const comboData = forecast?.map((f) => {
    const production = productionWithTimes?.find(
      (p) => p.date.getTime() === f.date.getTime()
    );
    return {
      ...f,
      production: production?.watts ?? 0,
    };
  });

  return (
    <div
      style={{
        boxSizing: "border-box",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-evenly",
        blockSize: "100vh",
      }}
    >
      <span
        style={{
          display: "flex",
          flexDirection: "column",
          blockSize: "100%",
          justifyContent: "space-evenly",
        }}
      >
        {!!comboData && (
          <LineChart
            width={window.innerWidth / 2}
            height={window.innerHeight / 3}
            data={comboData}
          >
            <Line dataKey={"watts"} dot={false} strokeDasharray="2 2"></Line>
            <Line dataKey={"production"} dot={false} strokeWidth={2}></Line>
            <XAxis dataKey={"date"} tickFormatter={formatter.format} />
            <YAxis max={maxWatts} tickFormatter={formatKw} />
          </LineChart>
        )}
        {!!days && (
          <LineChart
            width={window.innerWidth / 2}
            height={window.innerHeight / 3}
            data={days}
          >
            <Line dataKey={"value"} dot={false}></Line>
            <XAxis dataKey={"date"} tickFormatter={dayFormatter.format} />
            <YAxis max={maxWattHours} tickFormatter={formatKw} />
          </LineChart>
        )}
        {!!api && <div style={{ textAlign: "center" }}>{api} API</div>}
      </span>
      <span>
        {!!production && (
          <>
            Lifetime Value: {formatCurrency(totalValue)} (
            {formatCurrency(perDay)}
            /day)
            <br />
            Lifetime Production: {totalProduction}
            <br />
            <br />
          </>
        )}
        <div>
          {days?.map(({ value, date }) => {
            const startOfDay = new Date(date);
            startOfDay.setHours(0);
            startOfDay.setMinutes(0);
            const productionData = production?.find(
              (p) => p.startTime === startOfDay.getTime()
            );
            const sum = (
              (productionData?.productionData.reduce(
                (r: number, v) => r + (v ?? 0),
                0
              ) ?? 0) / 1000
            ).toFixed(1);
            const money = formatCurrency(productionData?.total ?? 0);
            return (
              <div key={date.getTime()}>
                {dayFormatter.format(date)}: {formatKw(value)}
                {!!production && (
                  <>
                    {" "}
                    (Actual: {sum}kW, {money})
                  </>
                )}
              </div>
            );
          })}
        </div>
      </span>
    </div>
  );
}
export default App;
