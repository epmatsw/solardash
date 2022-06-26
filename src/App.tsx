import React, { useDeferredValue, useEffect, useState } from "react";
import { Line, LineChart, XAxis, YAxis } from "recharts";
import { Data, forecastDataCacheKey, useForecast } from "./useForecast";
import {
  Dollar,
  ProductionStat,
  useProduction,
  Watt,
  WattHour,
} from "./useProduction";
import { isToday, isYesterday } from "date-fns";

const formatter = new Intl.DateTimeFormat("en-US", {
  weekday: "narrow",
});
const dayFormatter = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
});
const hourFormatter = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
});

const timeFormatter = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "numeric",
  second: "numeric",
});

const getLast7 = (i: ProductionStat[]): ProductionStat[] => {
  const a = i.filter((e) => !isToday(e.startTime));
  const len = a.length;
  if (len < 7) {
    return a.slice();
  } else {
    return a.slice(len - 7);
  }
};

const formatKwVague = (value: Watt) => `${Math.round(value / 1000)}kW`;
const formatKwh = (value: WattHour) => `${(value / 1000).toFixed(1)}kWh`;
const formatKwhVague = (value: Watt) => `${Math.round(value / 1000)}kWh`;
const formatKwhPrecise = (value: WattHour) => `${(value / 1000).toFixed(2)}kWh`;
const formatCurrency: (d: Dollar) => string = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
}).format;

const wrapWidth = 900;
const realBigWidth = 1600;

function App() {
  const [fetchCount, setFetchCount] = useState(Date.now());

  useEffect(() => {
    const interval = setInterval(() => {
      setFetchCount(Date.now());
    }, 2 * 60 * 1000);
    return () => {
      clearInterval(interval);
    };
  }, []);

  const { forecast, days, api, maxWatts, maxWattHours } =
    useForecast(fetchCount);
  const production = useProduction(fetchCount);

  const [big, setBig] = useState(
    window.matchMedia(`(min-width: ${wrapWidth}px)`).matches
  );
  const [realBig, setRealBig] = useState(
    window.matchMedia(`(min-width: ${realBigWidth}px)`).matches
  );
  const [_chartHeight, setChartHeight] = useState<number>();
  const [_chartWidth, setChartWidth] = useState<number>();

  const chartHeight = useDeferredValue(_chartHeight);
  const chartWidth = useDeferredValue(_chartWidth);

  useEffect(() => {
    const update = () => {
      const big = window.innerWidth >= wrapWidth;
      const realBig = window.innerWidth >= realBigWidth;
      if (big) {
        setChartHeight(window.innerHeight / 3 - 20);
        if (realBig) {
          setChartWidth(window.innerWidth * 0.75 - 20);
        } else {
          setChartWidth(window.innerWidth / 2 - 20);
        }
      } else {
        setChartHeight(window.innerHeight / 2 - 20);
        setChartWidth(window.innerWidth - 20);
      }
      setBig(big);
      setRealBig(realBig);
    };
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);
    update();
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
    };
  }, []);

  if (!forecast && !days && !production) return <div>Loading...</div>;

  const [totalValue, totalProductionNumber, productionDays] =
    production?.reduce<[Dollar, WattHour, number]>(
      (sums: [Dollar, WattHour, number], p) => {
        if (isToday(p.startTime) || typeof p.productionNum !== "number") {
          return sums;
        }
        return [
          (sums[0] + p.total) as Dollar,
          (sums[1] + p.productionNum) as WattHour,
          sums[2] + 1,
        ];
      },
      [0 as Dollar, 0 as WattHour, 0]
    ) ?? [0 as Dollar, 0 as WattHour, 0];
  const perDay =
    productionDays > 0
      ? ((totalValue / productionDays) as Dollar)
      : (0 as Dollar);

  const totalProduction = formatKwh(totalProductionNumber);

  const productionWithTimes:
    | Array<{ watts: Watt | undefined; date: Date }>
    | undefined = production?.flatMap((p) => {
    return p.productionData.map((d, i) => {
      return {
        watts: d == null ? undefined : ((d * 4) as Watt),
        date: new Date(p.startTime + i * 15 * 60 * 1000),
      };
    });
  });

  const yesterdaysProduction = productionWithTimes?.filter(
    (p): p is { date: Date; watts: Watt } =>
      isYesterday(p.date) && p.watts != null
  );

  const comboData = forecast?.map((f: Partial<Data>) => {
    const production = productionWithTimes?.find(
      (p) => p.date.getTime() === f.date?.getTime()
    );
    return {
      ...f,
      date: f.date!,
      production: production?.watts,
    };
  });

  if (comboData && yesterdaysProduction) {
    comboData.unshift(
      ...yesterdaysProduction.map((p) => ({
        date: p.date,
        production: p.watts,
      }))
    );
  }

  const [maxProduction, maxDailyProduction] =
    production?.reduce<[WattHour, WattHour]>(
      ([mw, md], p) => {
        const prodNumbers = p.productionData.filter((n): n is WattHour => !!n);
        return [
          Math.max(mw, ...prodNumbers) as WattHour,
          Math.max(md, p.productionNum) as WattHour,
        ];
      },
      [-Infinity as WattHour, -Infinity as WattHour]
    ) ?? ([0, 0] as [WattHour, WattHour]);

  const todayProduction = production?.find((p) => isToday(p.startTime));

  const todayData = comboData?.filter((d) => isToday(d.date));

  const isStandalone =
    (window.navigator as any).standalone === true ||
    !!window.matchMedia("(display-mode: standalone)").matches;

  return (
    <>
      <div
        style={{
          display: "flex",
          position: "fixed",
          top: "5px",
          right: "5px",
          zIndex: 1000,
        }}
      >
        {isStandalone && (
          <button
            onClick={() => {
              window.location.reload();
            }}
          >
            Hard Refresh
          </button>
        )}
        <button
          onClick={() => {
            if (process.env.NODE_ENV === "development") {
              localStorage.removeItem(forecastDataCacheKey);
            }
            setFetchCount(Date.now());
          }}
        >
          Refresh ({timeFormatter.format(fetchCount)})
        </button>
      </div>
      <div
        style={{
          boxSizing: "border-box",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-evenly",
          blockSize: "100svh",
          inlineSize: "100svw",
          padding: "5px",
          gap: "20px",
          flexWrap: big ? undefined : "wrap",
        }}
      >
        <span
          style={{
            display: "flex",
            flexDirection: "column",
            blockSize: big ? "100%" : "150%",
            justifyContent: "space-evenly",
            minInlineSize: "400px",
            alignItems: "center",
            flexBasis: big ? (realBig ? "75svw" : "50svw") : "100%",
          }}
        >
          {!!todayData && (
            <LineChart width={chartWidth} height={chartHeight} data={todayData}>
              <Line dataKey={"watts"} dot={false} strokeDasharray="2 2"></Line>
              <Line dataKey={"production"} dot={false} strokeWidth={2}></Line>
              <XAxis dataKey={"date"} tickFormatter={hourFormatter.format} />
              <YAxis max={maxWatts} tickFormatter={formatKwVague} />
            </LineChart>
          )}
          {!!comboData && (
            <LineChart width={chartWidth} height={chartHeight} data={comboData}>
              <Line dataKey={"watts"} dot={false} strokeDasharray="2 2"></Line>
              <Line dataKey={"production"} dot={false} strokeWidth={2}></Line>
              <XAxis dataKey={"date"} tickFormatter={formatter.format} />
              <YAxis max={maxWatts} tickFormatter={formatKwVague} />
            </LineChart>
          )}
          {!!days && (
            <LineChart width={chartWidth} height={chartHeight} data={days}>
              <Line dataKey={"value"} dot={false}></Line>
              <XAxis dataKey={"date"} tickFormatter={dayFormatter.format} />
              <YAxis max={maxWattHours} tickFormatter={formatKwhVague} />
            </LineChart>
          )}
        </span>
        <span
          style={{
            padding: "10px",
            flexBasis: big ? (realBig ? "25svw" : "50svw") : "100%",
          }}
        >
          {!!todayProduction && (
            <>
              <div>
                Today:
                <br />
                Value: {formatCurrency(todayProduction.total)}
                <br />
                Production: {formatKwhPrecise(todayProduction.productionNum)} (
                {formatCurrency(todayProduction.total)})
                <br />
                Off Peak: {formatKwhPrecise(todayProduction.offUsage)} (
                {formatCurrency(todayProduction.offTotal)})
                <br />
                Mid Peak: {formatKwhPrecise(todayProduction.midUsage)} (
                {formatCurrency(todayProduction.midTotal)})
                <br />
                On Peak: {formatKwhPrecise(todayProduction.peakUsage)} (
                {formatCurrency(todayProduction.peakTotal)})
              </div>
              <br />
            </>
          )}
          {!!production && (
            <>
              Last {productionDays} Days:
              <br />
              Value: {formatCurrency(totalValue)} ({formatCurrency(perDay)}
              /day)
              <br />
              Production: {totalProduction} (
              {formatKwh(
                (totalProductionNumber / (productionDays || 1)) as WattHour
              )}
              /day)
              <br />
              Max Output: {formatKwh((maxProduction * 4) as WattHour)}
              <br />
              Max Daily: {formatKwh(maxDailyProduction)}
              <br />
              <br />
              {getLast7(production).map((a) => (
                <React.Fragment key={a.startTime}>
                  <span>
                    {dayFormatter.format(a.startTime)}{" "}
                    {formatKwh(a.productionNum)} ({formatCurrency(a.total)})
                  </span>
                  <br />
                </React.Fragment>
              ))}
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
              const sum =
                productionData?.productionData.reduce<WattHour>(
                  (r: WattHour, v: WattHour | null) =>
                    (r + (v ?? (0 as WattHour))) as WattHour,
                  0 as WattHour
                ) ?? (0 as WattHour);
              const money = formatCurrency(
                productionData?.total ?? (0 as Dollar)
              );
              return (
                <div key={date.getTime()}>
                  {dayFormatter.format(date)}: {formatKwh(value)}
                  {!!production && (
                    <>
                      {" "}
                      (Actual: {formatKwhPrecise(sum)}, {money})
                    </>
                  )}
                </div>
              );
            })}
            <br />
            {!!api && <div>Using {api} API</div>}
          </div>
        </span>
      </div>
    </>
  );
}
export default App;
