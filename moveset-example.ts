import { Dex } from "@pkmn/dex";
import { Sets } from "@pkmn/sets";
import { Pokemon } from "@pkmn/sim";

(async () => {
  const gen9 = Dex.forGen(9);

  const pokemon = gen9.species.get("ivysaur");
  const learnsetData = await gen9.learnsets.get(pokemon.id);

  if (learnsetData && learnsetData.learnset) {
    const learnset = Object.entries(learnsetData.learnset)
      .map(([moveName, learnMethods]) => {
        const gen9LearnMethods = learnMethods.filter((lm) => lm[0] === "9");

        if (gen9LearnMethods.length === 0) return;

        return [moveName, gen9LearnMethods] as [string, string[]];
      })
      .filter((v) => v !== undefined);

    // `learnset` is an object where the keys are move IDs and the values are arrays
    // of learn methods (like ["8M", "8L1"] indicating move tutors, level-up moves, etc.)
    // If you want the full move names, you can map over them:
    const moveNames = learnset.map(([moveId, methods]) => {
      const getLearnedLevel = (method: string) => {
        const [gen, level] = method.split("L").map(Number);
        return gen !== undefined &&
          level !== undefined &&
          !isNaN(gen) &&
          !isNaN(level)
          ? undefined
          : level;
      };

      const methodsString = methods
        .map((encoded) => {
          const levelData = getLearnedLevel(encoded);
          if (levelData !== undefined) return `At level ${levelData}`;
          return `Unknown code ${encoded}`;
        })
        .join(", ");

      return `${gen9.moves.get(moveId).name} (${methodsString})`;
    });

    console.log(
      `Ivysaur can learn the following moves: ${moveNames.join(", ")}`
    );
  } else {
    console.log("No learnset data found for Ivysaur.");
  }
})();
