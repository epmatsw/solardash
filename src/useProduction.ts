import { useEffect, useState } from "react";

type RawProductionStat = {
  production: Array<number | null>;
  start_time: number;
}

type ProductionStat = {
  production: string;
  total: number;
  productionData: Array<number | null>;
  startTime: number;
  productionNum: number;
}

const offCost = 9;
const midCost = 18;
const peakCost = 26;

const getValue = ({ production: productionData, start_time }: RawProductionStat): ProductionStat => {
  const morning = productionData.slice(0, 52);
  const mid = productionData.slice(52, 60);
  const peak = productionData.slice(60, 76);
  const night = productionData.slice(76);
  const off = [...morning, ...night];

  const offUsage = off.reduce((total: number, val) => total + (val ?? 0), 0);
  const midUsage = mid.reduce((total: number, val) => total + (val ?? 0), 0);
  const peakUsage = peak.reduce((total: number, val) => total + (val ?? 0), 0);
  const totalUsage = offUsage + midUsage + peakUsage;

  const offTotal = (offUsage * offCost) / (100 * 1000);
  const peakTotal = (peakUsage * peakCost) / (100 * 1000);
  const midTotal = (midUsage * midCost) / (100 * 1000);
  const total = offTotal + peakTotal + midTotal;

    return {
      productionData,
      startTime: start_time * 1000,
      production: `${(totalUsage / 1000).toFixed(1)}kW`,
      productionNum: totalUsage,
      total,
    };
}

export const useProduction = () => {
  const [production, setProduction] = useState<ProductionStat[]>();
  useEffect(() => {
    (async function () {
      const fetchResult = await fetch(
        "https://api.allorigins.win/get?url=" + encodeURIComponent("https://enlighten.enphaseenergy.com/pv/public_systems/2875024/daily_energy?start_date=2022-06-01"),
        {
          body: null,
          method: "GET",
        }
      );
      const proxyResponse = await fetchResult.json();
      const { stats }= JSON.parse(proxyResponse.contents);
      setProduction(stats.map((s: RawProductionStat) => getValue(s)));
    })();
  }, []);

  return production;
}
