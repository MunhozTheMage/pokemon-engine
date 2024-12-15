import {
  Dex,
  Learnset,
  ModdedDex,
  NatureName,
  Species,
  TypeName,
} from "@pkmn/dex";

const GENERATION = 9;

type UnitPokemonStat = {
  hp: number;
  atk: number;
  def: number;
  spa: number;
  spd: number;
  spe: number;
};

type UnitPokemonMoveList =
  | [string]
  | [string, string]
  | [string, string, string]
  | [string, string, string, string];

type UnitPokemonInitOptions = {
  speciesName: string;
  generation?: number;
  nickname?: string;
  ability: string;
  level?: number;
  shiny?: boolean;
  happiness?: number;
  hiddenPowerType?: TypeName;
  teraType?: TypeName;
  evs?: Partial<UnitPokemonStat>;
  ivs?: Partial<UnitPokemonStat>;
  moves: UnitPokemonMoveList;
  gender?: "M" | "F";
  heldItem?: string;
  nature?: NatureName;
};

type UnitPokemonMove = {
  id: string;
};

type UnitPokemonLearnset = {
  level: Record<number, UnitPokemonMove[]>;
  others?: UnitPokemonMove[];
};

type UnitPokemonEvolution = {
  name: string;
} & (
  | {
      type: "useItem";
      item: string;
    }
  | {
      type: "levelFriendship";
      condition?: string;
    }
  | {
      type: "levelExtra";
      condition: string;
    }
  | {
      type: "level";
      level: number;
    }
  | {
      type: "levelHold";
      item: string;
      condition?: string;
    }
  | {
      type: "levelMove";
      move: string;
      condition?: string;
    }
  | {
      type: "trade";
      item?: string;
      condition?: string;
    }
  | {
      type: "other";
      condition: string;
    }
  | {
      type: "error";
      message: string;
    }
);

const decodeLevelLearnMethod = (encoded: string) => {
  const [gen, level] = encoded.split("L").map(Number);

  return gen !== undefined &&
    level !== undefined &&
    !isNaN(gen) &&
    !isNaN(level)
    ? level
    : undefined;
};

class UnitPokemon {
  private dexData?: ModdedDex;
  private speciesData?: Species;
  private learnsetData?: Learnset;

  private _nickname?: UnitPokemonInitOptions["nickname"];
  private _ability?: UnitPokemonInitOptions["ability"];
  private _happiness?: UnitPokemonInitOptions["happiness"];
  private _shiny?: UnitPokemonInitOptions["shiny"];
  private _level?: UnitPokemonInitOptions["level"];
  private _moves?: UnitPokemonInitOptions["moves"];
  private _heldItem?: UnitPokemonInitOptions["heldItem"];
  private _evs?: UnitPokemonInitOptions["evs"];
  private _ivs?: UnitPokemonInitOptions["ivs"];

  private EVOLUTIONS_CACHE?: UnitPokemonEvolution[];
  private LEARNSET_CACHE?: UnitPokemonLearnset;

  hiddenPowerType?: UnitPokemonInitOptions["hiddenPowerType"];
  teraType?: UnitPokemonInitOptions["teraType"];
  gender?: UnitPokemonInitOptions["gender"];
  nature?: UnitPokemonInitOptions["nature"];

  static async create(options: UnitPokemonInitOptions) {
    const unitPokemon = new UnitPokemon();
    await unitPokemon.__init__(options);
    return unitPokemon;
  }

  async __init__({
    speciesName,
    ability,
    moves,
    generation = GENERATION,
    evs,
    happiness,
    hiddenPowerType,
    ivs,
    level,
    nickname,
    shiny,
    teraType,
    gender,
    heldItem,
    nature,
  }: UnitPokemonInitOptions) {
    this.dexData = Dex.forGen(generation);
    this.speciesData = this.dexData.species.get(speciesName);
    this.learnsetData = await this.dexData.learnsets.get(speciesName);

    this.hiddenPowerType = hiddenPowerType;
    this._evs = evs;
    this._ivs = ivs;
    this.teraType = teraType;
    this.gender = gender;
    this.nature = nature;

    this._level = level;
    this._nickname = nickname;
    this._shiny = shiny;
    this._happiness = happiness;
    this._ability = ability;
    this._moves = moves;
    this._heldItem = heldItem;
  }

  private getInitializedData() {
    if (
      [
        this.dexData,
        this.speciesData,
        this.learnsetData,
        this._ability,
        this._moves,
      ].some((v) => v === undefined)
    )
      throw new Error("UnitPokemon not initialized.");

    return {
      dexData: this.dexData!,
      speciesData: this.speciesData!,
      learnsetData: this.learnsetData!,
      ability: this._ability!,
      moves: this._moves!,
    };
  }

  get speciesName() {
    const { speciesData } = this.getInitializedData();
    return speciesData.name;
  }

  get nickname() {
    return this._nickname || this.speciesName;
  }

  get level() {
    return this._level || 100;
  }

  get shiny() {
    return this._shiny || false;
  }

  get happiness() {
    return this._happiness || 255;
  }

  get ability() {
    const { dexData, ability } = this.getInitializedData();
    return dexData.abilities.get(ability);
  }

  get moves() {
    const { moves, dexData } = this.getInitializedData();
    return moves.map((move) => dexData.moves.get(move));
  }

  get heldItem() {
    if (!this._heldItem) return undefined;
    const { dexData } = this.getInitializedData();
    return dexData.moves.get(this._heldItem);
  }

  get evs() {
    const baseEvs = { ...this._evs };

    baseEvs.hp ||= 0;
    baseEvs.atk ||= 0;
    baseEvs.def ||= 0;
    baseEvs.spa ||= 0;
    baseEvs.spd ||= 0;
    baseEvs.spe ||= 0;

    return baseEvs as UnitPokemonStat;
  }

  get ivs() {
    const baseEvs = { ...this._ivs };

    baseEvs.hp ||= 31;
    baseEvs.atk ||= 31;
    baseEvs.def ||= 31;
    baseEvs.spa ||= 31;
    baseEvs.spd ||= 31;
    baseEvs.spe ||= 31;

    return baseEvs as UnitPokemonStat;
  }

  get evolutions() {
    if (this.EVOLUTIONS_CACHE) return this.EVOLUTIONS_CACHE;
    const { speciesData, dexData } = this.getInitializedData();

    const { evos } = speciesData;
    if (!evos) return [];

    const evolutions = evos
      .map((name): UnitPokemonEvolution | undefined => {
        const evoSpecies = dexData.species.get(name);

        if (evoSpecies.prevo !== speciesData.name) return undefined;

        switch (evoSpecies.evoType) {
          case "useItem":
            return {
              name: evoSpecies.name,
              type: "useItem",
              item: evoSpecies.evoItem!,
            };
          case "levelFriendship":
            return {
              name: evoSpecies.name,
              type: "levelFriendship",
              condition: evoSpecies.evoCondition,
            };
          case "levelExtra":
            return {
              name: evoSpecies.name,
              type: "levelExtra",
              condition: evoSpecies.evoCondition!,
            };
          case "levelHold":
            return {
              name: evoSpecies.name,
              type: "levelHold",
              item: evoSpecies.evoItem!,
              condition: evoSpecies.evoCondition,
            };
          case "levelMove":
            return {
              name: evoSpecies.name,
              type: "levelMove",
              move: evoSpecies.evoMove!,
              condition: evoSpecies.evoCondition,
            };
          case "trade":
            return {
              name: evoSpecies.name,
              type: "trade",
              item: evoSpecies.evoItem,
              condition: evoSpecies.evoCondition,
            };
          case "other":
            return {
              name: evoSpecies.name,
              type: "other",
              condition: evoSpecies.evoCondition!,
            };
        }

        if (!evoSpecies.evoType && typeof evoSpecies.evoLevel === "number")
          return {
            name: evoSpecies.name,
            type: "level",
            level: evoSpecies.evoLevel,
          };

        return {
          name: evoSpecies.name,
          type: "error",
          message: "Evolution type not implemented",
        };
      })
      .filter((evoData) => evoData !== undefined);

    this.EVOLUTIONS_CACHE = evolutions;
    return this.EVOLUTIONS_CACHE;
  }

  get learnset() {
    if (this.LEARNSET_CACHE !== undefined) return this.LEARNSET_CACHE;
    const { learnsetData } = this.getInitializedData();

    const rawLearnset = learnsetData.learnset;
    if (!rawLearnset) return { level: {} };

    const currentGenLearnset = Object.entries(rawLearnset)
      .map(([moveName, learningMethods]) => {
        const currentGenLearningMethods = learningMethods.filter(
          (learnMethod) => learnMethod[0] === String(GENERATION)
        );

        if (currentGenLearningMethods.length === 0) return undefined;
        return [moveName, currentGenLearningMethods] as [string, string[]];
      })
      .filter((v) => v !== undefined);

    const learnset = { level: {} } as UnitPokemonLearnset;

    currentGenLearnset.forEach(([moveName, learningMethods]) => {
      learningMethods.forEach((learningMethod) => {
        const levelMethodDecoded = decodeLevelLearnMethod(learningMethod);
        if (levelMethodDecoded !== undefined) {
          learnset.level[levelMethodDecoded] = [
            ...(learnset.level[levelMethodDecoded] || []),
            { id: moveName },
          ];

          return;
        }

        learnset.others = [...(learnset.others || []), { id: moveName }];
      });
    });

    this.LEARNSET_CACHE = learnset;
    return this.LEARNSET_CACHE;
  }

  private serializeHeader() {
    let header = "";

    if (this.nickname !== this.speciesName) {
      header += `${this.nickname} (${this.speciesName})`;
    } else {
      header += this.speciesName;
    }

    if (this.gender) {
      header += ` (${this.gender})`;
    }

    if (this.heldItem) {
      header += ` @ ${this.heldItem.name}`;
    }

    return header;
  }

  private serializeStats(stats: Partial<UnitPokemonStat>) {
    return Object.entries(stats)
      .map(([key, value]) => {
        switch (key) {
          case "hp":
            return `${value} HP`;
          case "atk":
            return `${value} Atk`;
          case "def":
            return `${value} Def`;
          case "spa":
            return `${value} SpA`;
          case "spd":
            return `${value} SpD`;
          case "spe":
            return `${value} Spe`;
        }
      })
      .filter((v) => v !== undefined)
      .join(" / ");
  }

  private serializeMoves() {
    return this.moves.map((move) => `- ${move.name}`).join("\n");
  }

  serialize() {
    let serializedPokemon = "";

    serializedPokemon += this.serializeHeader() + "\n";
    serializedPokemon += `Ability: ${this.ability.name}\n`;

    if (this.level !== 100) {
      serializedPokemon += `Level: ${this.level}\n`;
    }

    if (this.shiny) {
      serializedPokemon += "Shiny: Yes\n";
    }

    if (this.happiness !== 255) {
      serializedPokemon += `Happiness: ${this.happiness}\n`;
    }

    if (this.hiddenPowerType) {
      serializedPokemon += `Hidden Power: ${this.hiddenPowerType}\n`;
    }

    if (this.teraType) {
      serializedPokemon += `Tera Type: ${this.teraType}\n`;
    }

    const nonStandardEvs = Object.entries(this.evs).filter(
      ([_key, value]) => value !== 0
    );
    if (nonStandardEvs.length > 0) {
      serializedPokemon += `EVs: ${this.serializeStats(
        Object.fromEntries(nonStandardEvs)
      )}\n`;
    }

    if (this.nature) {
      serializedPokemon += `${this.nature} Nature`;
    }

    const nonStandardIvs = Object.entries(this.ivs).filter(
      ([_key, value]) => value !== 31
    );
    if (nonStandardIvs.length > 0) {
      serializedPokemon += `IVs: ${this.serializeStats(
        Object.fromEntries(nonStandardIvs)
      )}\n`;
    }

    serializedPokemon += this.serializeMoves();

    return serializedPokemon;
  }
}

UnitPokemon.create({
  speciesName: "eevee",
  ability: "adaptability",
  moves: ["Covet", "Sand Attack"],
  evs: {
    spa: 252,
  },
  heldItem: "Eviolite",
  shiny: true,
  gender: "F",
}).then((unitPokemon) => {
  console.log("ABILITY: ", unitPokemon.ability);
  console.log("EVOLUTIONS: ", unitPokemon.evolutions);
  console.log("EVs: ", unitPokemon.evs);
  console.log("HAPPINESS: ", unitPokemon.happiness);
  console.log("HIDDEN POWER: ", unitPokemon.hiddenPowerType);
  console.log("IVs: ", unitPokemon.ivs);
  console.log("LEARNSET: ", unitPokemon.learnset);
  console.log("LEVEL: ", unitPokemon.level);
  console.log("MOVES: ", unitPokemon.moves);
  console.log("NICKNAME: ", unitPokemon.nickname);
  console.log("SHINY: ", unitPokemon.shiny);
  console.log("SPECIES NAME: ", unitPokemon.speciesName);
  console.log("TERA TYPE: ", unitPokemon.teraType);

  console.log("\nSERIALIZED: ", unitPokemon.serialize());
});
