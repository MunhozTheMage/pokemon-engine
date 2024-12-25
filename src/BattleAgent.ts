import { ObjectReadWriteStream } from "@pkmn/sim/build/cjs/lib/streams";
import { splitFirst } from "./helpers/protocol.helper";
import { AnyObject } from "@pkmn/sim";

export default class BattleAgent {
  protected readonly playerStream: ObjectReadWriteStream<string>;

  constructor(playerStream: ObjectReadWriteStream<string>) {
    this.playerStream = playerStream;
  }

  async start() {
    for await (const chunk of this.playerStream) {
      this.receive(chunk);
    }
  }

  protected receive(chunk: string) {
    for (const line of chunk.split("\n")) {
      this.receiveLine(line);
    }
  }

  protected receiveLine(line: string) {
    if (!line.startsWith("|")) return;
    const [cmd, rest] = splitFirst(line.slice(1), "|");

    if (cmd === "error") return this.processError(new Error(rest));

    if (cmd === "request" && rest) {
      const output = this.processRequest(JSON.parse(rest));
      if (output) this.playerStream.write(output);
    }
  }

  protected processError(error: Error) {
    // If we made an unavailable choice we will receive a followup request to
    // allow us the opportunity to correct our decision.
    console.error(error);
    if (error.message.startsWith("[Unavailable choice]")) return;
    throw error;
  }

  protected processRequest(request: AnyObject): string | undefined {
    console.log(request);
    return;
  }

  protected writeChoice(choice: string) {
    this.playerStream.write(choice);
  }
}
