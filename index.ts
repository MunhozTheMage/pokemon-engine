import { BattleStreams, Teams } from "@pkmn/sim";
import { Dex } from "@pkmn/sim";
import { Formats } from "./myformats";
import { TeamGenerators } from "@pkmn/randoms";
import ProtocolWritter from "./ProtocolWritter";
import ProtocolRandomAI from "./basic-ai";
import { writeFileSync } from "fs";

Dex.formats.extend(Formats);
Teams.setGeneratorFactory(TeamGenerators);

// Main battle simulation
async function runBattle() {
  const battleStream = new BattleStreams.BattleStream();
  const playerStreams = BattleStreams.getPlayerStreams(battleStream);

  // Generate teams for both players
  const team1 = Teams.generate("gen9randombattle");
  const team2 = Teams.generate("gen9randombattle");

  const startingChunk = ProtocolWritter.asChunk(
    ProtocolWritter.startBattle("gen9randombattle"),
    ProtocolWritter.setPlayer("p1", { nickname: "AI-1", team: team1 }),
    ProtocolWritter.setPlayer("p2", { nickname: "AI-2", team: team2 })
  );

  // Start the battle with the generated teams
  await battleStream.write(startingChunk);
  let stack = startingChunk;

  const player1AI = new ProtocolRandomAI("p1", playerStreams.p1);
  const player2AI = new ProtocolRandomAI("p2", playerStreams.p2);

  player1AI.start();
  player2AI.start();

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
