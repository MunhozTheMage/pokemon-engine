import { UnitPokemon } from "./UnitPokemon";
import ProtocolWritter, { PlayerSide } from "./ProtocolWritter";
import { PokemonSet } from "@pkmn/sim";
import { Sets } from "@pkmn/sets";
import BattleAgent from "./BattleAgent";
import { range } from "./helpers/array.helper";

type BattleEntityInitOptions = {
  side: PlayerSide;
  team: UnitPokemon[] | ReturnType<typeof UnitPokemon.create>[];
  name: string;
  agent: BattleAgent;
};

export default class BattleEntity {
  _side?: PlayerSide;
  _team?: UnitPokemon[];
  _name?: string;
  _agent?: BattleAgent;

  static async create(options: BattleEntityInitOptions) {
    const battleEntity = new BattleEntity();
    await battleEntity.__init__(options);
    return battleEntity;
  }

  async __init__({ side, team, name, agent }: BattleEntityInitOptions) {
    this._side = side;
    this._name = name;
    this._agent = agent;

    this._team = await Promise.all(team);
  }

  get side() {
    return this._side!;
  }

  get team() {
    return this._team!;
  }

  get name() {
    return this._name!;
  }

  private getInitializedData() {
    if ([this._agent].some((v) => v === undefined))
      throw new Error("BattleEntity not initialized.");

    return {
      agent: this._agent!,
    };
  }

  writeSpecs() {
    return ProtocolWritter.setPlayer(this.side, {
      nickname: this.name,
      team: this.team.map(
        (pokemonUnit) => Sets.importSet(pokemonUnit.serialize()) as PokemonSet
      ),
    });
  }

  writeTeamOrder() {
    return ProtocolWritter.setTeamOrder(this.side, range(1, this.team.length));
  }

  startStreaming() {
    const { agent } = this.getInitializedData();
    agent.start();
  }
}
