import { BattleStreams, Teams } from "@pkmn/sim";
import { Dex } from "@pkmn/sim";
import { Formats } from "./myformats";
import { TeamGenerators } from "@pkmn/randoms";
import ProtocolWritter from "./src/ProtocolWritter";
import { writeFileSync } from "fs";
import RandomAIAgent from "./src/RandomAIAgent";
import BattleEntity from "./src/BattleEntity";
import { UnitPokemon } from "./src/UnitPokemon";

Dex.formats.extend(Formats);
Teams.setGeneratorFactory(TeamGenerators);

// Main battle simulation
async function runBattle() {
  const battleStream = new BattleStreams.BattleStream();
  const playerStreams = BattleStreams.getPlayerStreams(battleStream);

  const team1 = [
    UnitPokemon.create({
      speciesName: "golem",
      ability: "sturdy",
      moves: ["Rock Blast"],
    }),
  ];

  const team2 = [
    UnitPokemon.create({
      speciesName: "gyarados",
      ability: "intimidate",
      moves: ["Ice Fang"],
    }),
  ];

  const player1promise = BattleEntity.create({
    agent: new RandomAIAgent(playerStreams.p1),
    name: "AI-1",
    side: "p1",
    team: team1,
  });

  const player2promise = BattleEntity.create({
    agent: new RandomAIAgent(playerStreams.p2),
    name: "AI-2",
    side: "p2",
    team: team2,
  });

  const [player1, player2] = await Promise.all([
    player1promise,
    player2promise,
  ]);

  const startingChunk = ProtocolWritter.asChunk(
    ProtocolWritter.startBattle("gen9story"),
    player1.writeSpecs(),
    player2.writeSpecs(),
    player1.writeTeamOrder(),
    player2.writeTeamOrder()
  );

  await battleStream.write(startingChunk);
  let stack = "";

  player1.startStreaming();
  player2.startStreaming();

  void (async () => {
    for await (const chunk of playerStreams.omniscient) {
      console.log(chunk);
      stack += chunk;
    }
  })();

  setTimeout(() => {
    writeFileSync("./log.txt", stack);
  }, 5000);
}

runBattle().catch((err) => console.error(err));
