import fs from "fs/promises";
import { execFileSync } from "child_process";

const numToString = (n) => {
  if (n < 10) {
    return `0${n}`;
  } else {
    return n.toString();
  }
};

const update = async () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const date = now.getDate();
  console.log(`Updating at ${now}`);

  const previousData = JSON.parse(
    await fs.readFile("./public/data.json", { encoding: "utf8" })
  );

  const url = `https://enlighten.enphaseenergy.com/pv/public_systems/2875024/daily_energy?start_date=${year}-${numToString(
    month
  )}-${numToString(date)}&end_date=${year}-${numToString(month)}-${numToString(
    date
  )}`;

  const todaysData = await (await fetch(url)).json();

  const datesToReplace = new Map(
    todaysData.stats.map((s) => [s.start_time, s])
  );

  const newData = {
    stats: previousData.stats
      .filter(({ production }) => production.some((p) => typeof p === "number"))
      .map((existingStat) => {
        if (datesToReplace.has(existingStat.start_time)) {
          const newStat = datesToReplace.get(existingStat.start_time);
          datesToReplace.delete(existingStat.start_time);
          return newStat;
        } else {
          return existingStat;
        }
      }),
  };

  newData.stats.push(...Array.from(datesToReplace.values()));

  await fs.writeFile("./public/data.json", JSON.stringify(newData, null, 4), {
    encoding: "utf8",
  });

  execFileSync("git", [
    "add",
    "./public/data.json",
  ]);

  execFileSync("git", [
    "commit",
    "-n",
    "-m",
    `'Update data at ${now}'`,
  ]);

  execFileSync("git", [
    "push"
  ]);

  console.log(`Finished update at ${now}`);
};

await update();
setInterval(update, 15 * 60 * 1000);