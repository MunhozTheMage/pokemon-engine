import { BattleStreams, RandomPlayerAI, Teams } from "@pkmn/sim";
import { PokemonSet, Sets } from "@pkmn/sets";

import fs from "fs";

const streams = BattleStreams.getPlayerStreams(
  new BattleStreams.BattleStream()
);
const spec = { formatid: "gen9nationaldex" };

const charmander = Sets.importSet(
  `Charmander  
   Ability: Solar Power  
   Level: 1  
   Tera Type: Dragon  
   EVs: 1 HP  
   - Ember  
   - Protect  
   - Tackle  
   - Sunny Day
  `
) as PokemonSet;

const squirtle = Sets.importSet(
  `Squirtle  
   Ability: Rain Dish  
   Level: 1  
   Tera Type: Dragon  
   EVs: 1 HP  
   - Bubble  
   - Protect  
   - Rain Dance  
   - Tackle
  `
) as PokemonSet;

const p1spec = {
  name: "Sakura",
  team: Teams.pack([charmander, squirtle]),
};
const p2spec = {
  name: "Kuro",
  team: Teams.pack([squirtle, charmander]),
};

let stack = "";

const p1 = new RandomPlayerAI(streams.p1);
const p2 = new RandomPlayerAI(streams.p2);

void p1.start();
void p2.start();

void (async () => {
  for await (const chunk of streams.omniscient as any) {
    console.log(chunk);
    stack += chunk + "\n";
  }
})();

const specs = `>start ${JSON.stringify(spec)}
>player p1 ${JSON.stringify(p1spec)}
>player p2 ${JSON.stringify(p2spec)}`;

stack += specs + "\n";

void streams.omniscient.write(specs);

setTimeout(() => {
  fs.writeFileSync("log.txt", stack);
}, 5000);
