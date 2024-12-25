import { FormatList } from "@pkmn/sim/build/cjs/sim/dex-formats";

export const Formats: FormatList = [
  {
    section: "Story Formats",
  },
  {
    name: "[Gen 9] Story",
    mod: "gen9",
    ruleset: ["Standard NatDex"],
  },
  {
    name: "[Gen 9] Story Doubles",
    mod: "gen9",
    gameType: "doubles",
    ruleset: ["Standard NatDex"],
  },
  {
    name: "[Gen 9] Story Multi",
    mod: "gen9",
    gameType: "multi",
    ruleset: ["Standard NatDex"],
  },
  {
    name: "[Gen 9] Story Free-For-All",
    mod: "gen9",
    gameType: "freeforall",
    ruleset: ["Standard NatDex"],
  },
];
