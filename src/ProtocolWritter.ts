import { PokemonSet } from "@pkmn/sets";
import { Teams } from "@pkmn/sim";

export type PlayerSide = "p1" | "p2" | "p3" | "p4";
export enum MoveGimmik {
  Mega = "mega",
  ZMove = "zmove",
  Dynamax = "dynamax",
  Terastallize = "terastallize",
  UltraBurst = "ultra",
}
export type NPokemonsFormat = 1 | 2 | 3;

export default class ProtocolWritter {
  static startBattle(formatId: string) {
    return `>start ${JSON.stringify({ formatid: formatId })}`;
  }

  static setPlayer(
    side: PlayerSide,
    {
      nickname,
      team,
    }: {
      nickname: string;
      team: PokemonSet[];
    }
  ) {
    return `>player ${side} ${JSON.stringify({ name: nickname, team })}`;
  }

  static setTeamOrder(side: PlayerSide, order: number[] = [1, 2, 3, 4, 5, 6]) {
    return `>${side} team ${order.join("")}`;
  }

  static makeChoice(side: PlayerSide, choice: string) {
    return `>${side} ${choice}`;
  }

  static join(...choices: string[]) {
    return choices.join(", ");
  }

  static choosePass() {
    return "pass";
  }

  static chooseMove(slot: number, position?: number, gimmik?: MoveGimmik) {
    let choiceString = "move " + slot;
    if (position) choiceString += " " + position;
    if (gimmik) choiceString += " " + gimmik;
    return choiceString;
  }

  static chooseSwitch(slot: number) {
    return `switch ${slot}`;
  }

  static asChunk(...args: string[]) {
    return args.join("\n");
  }
}
