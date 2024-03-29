import { useEffect, useState } from "react";
import { isWeekend, isSameDay, getMonth } from "date-fns";
// @ts-expect-error
import holidays from "@date/holidays-us";
import { subDays } from "date-fns/esm";

type RawProductionStat = {
  production: Array<WattHour | null>;
  start_time: number;
};

export type ProductionStat = {
  production: string;
  total: Dollar;
  productionData: Array<WattHour | null>;
  startTime: number;
  productionNum: WattHour;
  offUsage: WattHour;
  midUsage: WattHour;
  peakUsage: WattHour;
  offTotal: Dollar;
  midTotal: Dollar;
  peakTotal: Dollar;
};

export type Watt = number & {
  _watt: any;
};

export type WattHour = number & {
  _wattHour: any;
};

export type Kilowatt = number & {
  _kw: any;
};

export type KilowattHour = number & {
  _kwh: any;
};

type Cent = number & {
  _cent: any;
};

export type Dollar = number & {
  _dollar: any;
};

const offCostSummer = 10 as Cent;
const midCostSummer = 19 as Cent;
const peakCostSummer = 28 as Cent;
const offCostWinter = 11 as Cent;
const midCostWinter = 14 as Cent;
const peakCostWinter = 17 as Cent;

const centsToDollars = (c: Cent): Dollar => (c / 100) as Dollar;
const wattHoursToKWh = (w: WattHour): KilowattHour =>
  (w / 1000) as KilowattHour;

const thisYear = new Date().getFullYear();
const newYearsDay = holidays.newYearsDay(thisYear);
const memorialDay = holidays.memorialDay(thisYear);
const independenceDay = holidays.independenceDay(thisYear);
const laborDay = holidays.laborDay(thisYear);
const thanksgiving = holidays.thanksgiving(thisYear);
const christmas = holidays.christmas(thisYear);

const holidayDays = [
  newYearsDay,
  memorialDay,
  independenceDay,
  laborDay,
  thanksgiving,
  christmas,
];

const getValue = ({
  production: productionData,
  start_time,
}: RawProductionStat): ProductionStat => {
  const month = getMonth(start_time);
  const isWinter = month >= 9 || month < 5;
  let off: Array<WattHour | null> = [],
    mid: Array<WattHour | null> = [],
    peak: Array<WattHour | null> = [];
  if (isWeekend(start_time * 1000)) {
    off.push(...productionData);
  } else if (holidayDays.some((day) => isSameDay(start_time * 1000, day))) {
    // https://my.xcelenergy.com/customersupport/s/article/What-are-the-six-observed-holidays-that-are-considered-off-peak
    off.push(...productionData);
  } else {
    const morning = productionData.slice(0, 52);
    const night = productionData.slice(76);
    off.push(...morning, ...night);
    mid.push(...productionData.slice(52, 60));
    peak.push(...productionData.slice(60, 76));
  }

  const offUsage = off.reduce<WattHour>(
    (total: WattHour, val) => (total + (val ?? (0 as WattHour))) as WattHour,
    0 as WattHour
  );
  const midUsage = mid.reduce<WattHour>(
    (total: WattHour, val) => (total + (val ?? (0 as WattHour))) as WattHour,
    0 as WattHour
  );
  const peakUsage = peak.reduce<WattHour>(
    (total: WattHour, val) => (total + (val ?? (0 as WattHour))) as WattHour,
    0 as WattHour
  );
  const totalUsage: WattHour = (offUsage + midUsage + peakUsage) as WattHour;

  const offCost = isWinter ? offCostWinter : offCostSummer;
  const peakCost = isWinter ? peakCostWinter : peakCostSummer;
  const midCost = isWinter ? midCostWinter : midCostSummer;

  const offTotal = (centsToDollars(offCost) *
    wattHoursToKWh(offUsage)) as Dollar;
  const peakTotal = (centsToDollars(peakCost) *
    wattHoursToKWh(peakUsage)) as Dollar;
  const midTotal = (centsToDollars(midCost) *
    wattHoursToKWh(midUsage)) as Dollar;
  const total = (offTotal + peakTotal + midTotal) as Dollar;

  return {
    productionData,
    startTime: start_time * 1000,
    production: `${(totalUsage / 1000).toFixed(1)}kW`,
    productionNum: totalUsage,
    total,
    offUsage,
    midUsage,
    peakUsage,
    offTotal,
    peakTotal,
    midTotal,
  };
};

type DateInfo = {
  year: number;
  month: number;
  date: number;
};

const firstDay = {
  year: 2022,
  month: 6,
  date: 1,
};

const numToString = (n: number) => {
  if (n < 10) {
    return `0${n}`;
  } else {
    return n.toString();
  }
};

const loadFromDate = async (from: DateInfo, to: DateInfo) => {
  const fetchResult = await fetch(
    "https://api.allorigins.win/get?url=" +
      encodeURIComponent(
        `https://enlighten.enphaseenergy.com/pv/public_systems/2875024/daily_energy?start_date=${
          from.year
        }-${numToString(from.month)}-${numToString(from.date)}&end_date=${
          to.year
        }-${numToString(to.month)}-${numToString(to.date)}`
      ),
    {
      body: null,
      method: "GET",
    }
  );
  const proxyResponse = await fetchResult.json();
  const { stats } = JSON.parse(proxyResponse.contents);
  return (stats as any[]).map((s: RawProductionStat) => getValue(s));
};
const today = new Date();
const month = today.getMonth() + 1;
const year = today.getFullYear();
const date = today.getDate();
const recentDay = subDays(today, 5);
const recentInfo = {
  month: recentDay.getMonth() + 1,
  year: recentDay.getFullYear(),
  date: recentDay.getDate(),
};

let recent: ProductionStat[] | undefined;
const recentPromise = (async function () {
  try {
    return await loadFromDate(recentInfo, {
      year,
      month,
      date,
    });
  } catch {
    return [];
  }
})();

let old: ProductionStat[] | undefined;
const oldPromise = (async function () {
  try {
    return await loadFromDate(firstDay, recentInfo);
  } catch {
    return [];
  }
})();

export const useProduction = () => {
  const [production, setProduction] = useState<ProductionStat[]>();
  useEffect(() => {
    (async function () {
      recent ??= await recentPromise;
      if (old) {
        setProduction([...old, ...recent]);
        return;
      } else {
        setProduction(recent);
      }
      old ??= await oldPromise;
      setProduction([...old, ...recent]);
    })();
  }, []);

  return production;
};
