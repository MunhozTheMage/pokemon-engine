import { Teams } from "@pkmn/sim";
import { UnitPokemon } from "./UnitPokemon";
import { PokemonSet, Sets } from "@pkmn/sets";

type BattleEntityInitOptions = {
  position: 1 | 2 | 3 | 4;
  team: UnitPokemon[] | ReturnType<typeof UnitPokemon.create>[];
  name: string;
};

class BattleEntity {
  _position?: number;
  _team?: UnitPokemon[];
  _name?: string;

  static async create(options: BattleEntityInitOptions) {
    const battleEntity = new BattleEntity();
    await battleEntity.__init__(options);
    return battleEntity;
  }

  async __init__({ position, team, name }: BattleEntityInitOptions) {
    this._position = position;
    this._name = name;

    this._team = await Promise.all(team);
  }

  get position() {
    return this._position!;
  }

  get team() {
    return this._team!;
  }

  get name() {
    return this._name!;
  }

  writeSpecs() {
    return `>player p${this.position} ${JSON.stringify({
      name: this.name,
      team: Teams.pack(
        this.team.map(
          (pokemonUnit) => Sets.importSet(pokemonUnit.serialize()) as PokemonSet
        )
      ),
    })}`;
  }
}
