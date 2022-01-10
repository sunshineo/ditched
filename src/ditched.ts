#! /usr/bin/env node
import path from "path";
import fs from "fs";
import https from "https";
import CliTable from "cli-table";
import chalk from "chalk";
import yargs from "yargs/yargs";
import { hideBin } from "yargs/helpers";

import { differenceInMilliseconds, formatTimeSince } from "./time";

const MS_IN_A_DAY = 1000 * 60 * 60 * 24;
const REGISTRY_URL = "https://registry.npmjs.org";

async function parseArgs() {
  return await yargs(hideBin(process.argv)).options({
    all: {
      type: "boolean",
      default: false,
      alias: ["a"],
      description:
        "Include all dependencies in the resulting table, not only those that are ditched",
    },
    days: {
      type: "number",
      default: 365,
      alias: ["d"],
      description:
        "The number of days since last release needed to consider a package as ditched",
    },
  }).argv;
}

function getJSON<T>(url: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const request = https.get(url, (response) => {
      if (!response.statusCode || response.statusCode >= 400) {
        return reject(
          new Error(
            `Could not fetch URL ${url} package info. Status code ${response.statusCode}`
          )
        );
      }
      const body: any[] = [];
      response.on("data", (chunk) => body.push(chunk));
      response.on("end", () => resolve(JSON.parse(body.join(""))));
      request.on("error", (err) => reject(err));
    });
  });
}

type PackageInfo = {
  name: string;
  modifiedDate?: Date;
};

function isDitched({ modifiedDate }: PackageInfo, ditchDays: number): boolean {
  if (!modifiedDate) return false;
  const ageDays =
    differenceInMilliseconds(new Date(), modifiedDate) / MS_IN_A_DAY;
  return ageDays > ditchDays;
}

function printInfoTable(
  dataForPackages: PackageInfo[],
  showAllPackages: boolean,
  ditchDays: number
): void {
  const packagesToShow = dataForPackages.filter(
    (data) => showAllPackages || isDitched(data, ditchDays)
  );

  if (!packagesToShow.length) {
    return;
  }

  const table = new CliTable({
    head: [
      chalk.gray("Package"),
      chalk.gray("Last Modified"),
      chalk.gray("Ditched?"),
    ],
    colWidths: [30, 40, 15],
  });

  packagesToShow
    .sort((a, b) => {
      if (!a.modifiedDate) return -1;
      if (!b.modifiedDate) return 1;
      return differenceInMilliseconds(b.modifiedDate, a.modifiedDate);
    })
    .forEach((packageInfo) => {
      const { name, modifiedDate } = packageInfo;

      const formattedTime = modifiedDate
        ? formatTimeSince(modifiedDate)
        : "No package info found.";

      let ditchedInfo = chalk.red("?");
      if (modifiedDate) {
        ditchedInfo = isDitched(packageInfo, ditchDays)
          ? chalk.red("Yes")
          : chalk.green("No");
      }

      table.push([name, formattedTime, ditchedInfo]);
    });

  console.log(table.toString());
}

async function getInfoForPackage(packageName: string): Promise<PackageInfo> {
  try {
    const regUrl = REGISTRY_URL + "/" + packageName;
    const response = await getJSON<{ time: { modified: string } }>(regUrl);
    const modifiedDate = new Date(response.time.modified);

    return {
      name: packageName,
      modifiedDate,
    };
  } catch (error) {
    return {
      name: packageName,
    };
  }
}

async function main() {
  const argv = await parseArgs();

  const packageJsonPath = path.join(process.cwd(), "package.json");

  const packageJsonStr = fs.readFileSync(packageJsonPath, {
    encoding: "utf8",
  });

  const { dependencies = {}, devDependencies = {} } =
    JSON.parse(packageJsonStr);

  const packages = [
    ...Object.keys(dependencies),
    ...Object.keys(devDependencies),
  ];

  const dataForPackages = await Promise.all(packages.map(getInfoForPackage));
  printInfoTable(dataForPackages, argv.all, argv.days);

  if (dataForPackages.filter(isDitched).length > 0) {
    process.exit(1);
  }
}

main();
