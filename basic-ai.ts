import { AnyObject, PRNG, PRNGSeed } from "@pkmn/sim";
import ProtocolWritter, {
  MoveGimmik,
  NPokemonsFormat,
  PlayerSide,
} from "./ProtocolWritter";
import { ObjectReadWriteStream } from "@pkmn/sim/build/cjs/lib/streams";

function range(start: number, end?: number, step = 1) {
  if (end === undefined) {
    end = start;
    start = 0;
  }
  const result = [];
  for (; start <= end; start += step) {
    result.push(start);
  }
  return result;
}

function splitFirst(str: string, delimiter: string, limit = 1) {
  const splitStr: string[] = [];
  while (splitStr.length < limit) {
    const delimiterIndex = str.indexOf(delimiter);
    if (delimiterIndex >= 0) {
      splitStr.push(str.slice(0, delimiterIndex));
      str = str.slice(delimiterIndex + delimiter.length);
    } else {
      splitStr.push(str);
      str = "";
    }
  }
  splitStr.push(str);
  return splitStr;
}

export default class ProtocolRandomAI {
  protected readonly move: number;
  protected readonly mega: number;
  protected readonly prng: PRNG;
  protected readonly side: PlayerSide;
  protected readonly nFormat: Exclude<NPokemonsFormat, 3>;
  protected readonly playerStream: ObjectReadWriteStream<string>;

  constructor(
    side: PlayerSide,
    playerStream: ObjectReadWriteStream<string>,
    options: {
      move?: number;
      mega?: number;
      seed?: PRNG | PRNGSeed | null;
      nFormat?: NPokemonsFormat;
    } = {}
  ) {
    if (options.nFormat === 3) {
      throw new Error("Tripple Battle not supported");
    }

    this.playerStream = playerStream;
    this.nFormat = options.nFormat || 1;
    this.side = side;
    this.move = options.move || 1.0;
    this.mega = options.mega || 0;
    this.prng =
      options.seed && !Array.isArray(options.seed)
        ? options.seed
        : new PRNG(options.seed);
  }

  async start() {
    for await (const chunk of this.playerStream) {
      this.receive(chunk);
    }
  }

  receive(chunk: string) {
    for (const line of chunk.split("\n")) {
      this.receiveLine(line);
    }
  }

  receiveLine(line: string) {
    if (!line.startsWith("|")) return;
    const [cmd, rest] = splitFirst(line.slice(1), "|");
    if (cmd === "error") return this.processError(new Error(rest));

    if (cmd === "request" && rest) {
      const output = this.processRequest(JSON.parse(rest));
      if (output) this.playerStream.write(output);
    }
  }

  private processError(error: Error) {
    // If we made an unavailable choice we will receive a followup request to
    // allow us the opportunity to correct our decision.
    if (error.message.startsWith("[Unavailable choice]")) return;
    throw error;
  }

  private processRequest(request: AnyObject): string | undefined {
    if (request.wait) return;
    if (request.forceSwitch) return this.onForceSwitch(request);
    if (request.active) return this.onActive(request);
    this.handleOtherRequest(request);
  }

  private onForceSwitch(request: AnyObject): string {
    const pokemon = request.side.pokemon;
    const chosen: number[] = [];

    const choices = (request.forceSwitch as AnyObject[]).map(
      (mustSwitch, i) => {
        if (!mustSwitch) return;

        const switchSlotOptions = range(1, 6).filter(
          (j) =>
            pokemon[j - 1] &&
            // not active
            j > request.forceSwitch.length &&
            // not chosen for a simultaneous switch
            !chosen.includes(j) &&
            // not fainted or fainted and using Revival Blessing
            !!(
              +!!pokemon[i].reviving ^
              +!pokemon[j - 1].condition.endsWith(` fnt`)
            )
        );

        if (switchSlotOptions.length === 0) return;

        const target = this.chooseSwitch(
          request.active,
          switchSlotOptions.map((slot) => ({
            slot,
            pokemon: pokemon[slot - 1],
          }))
        );

        chosen.push(target);
        return target;
      }
    );

    const firstChoice = choices[0];
    const secondChoice = choices[1];

    if (this.nFormat === 1) {
      return firstChoice
        ? ProtocolWritter.chooseSwitch(firstChoice)
        : ProtocolWritter.choosePass();
    }

    return ProtocolWritter.doublesFormatChoice(
      ...([firstChoice, secondChoice].map((choice) => {
        if (!choice) return ProtocolWritter.choosePass();
        return ProtocolWritter.chooseSwitch(choice);
      }) as [string, string])
    );
  }

  private onActive(request: AnyObject) {
    let canMegaEvo = true;
    let canUltraBurst = true;
    let canZMove = true;
    let canDynamax = true;
    let canTerastallize = true;

    const pokemon = request.side.pokemon;
    const chosen: number[] = [];
    const choices = (request.active as AnyObject[]).map((active, i): string => {
      if (pokemon[i].condition.endsWith(` fnt`) || pokemon[i].commanding)
        return `pass`;

      canMegaEvo = canMegaEvo && active.canMegaEvo;
      canUltraBurst = canUltraBurst && active.canUltraBurst;
      canZMove = canZMove && !!active.canZMove;
      canDynamax = canDynamax && !!active.canDynamax;
      canTerastallize = canTerastallize && !!active.canTerastallize;

      // Determine whether we should change form if we do end up switching
      const change =
        (canMegaEvo || canUltraBurst || canDynamax) &&
        this.prng.next() < this.mega;

      // If we've already dynamaxed or if we're planning on potentially dynamaxing
      // we need to use the maxMoves instead of our regular moves
      const useMaxMoves =
        (!active.canDynamax && active.maxMoves) || (change && canDynamax);
      const possibleMoves = useMaxMoves
        ? active.maxMoves.maxMoves
        : active.moves;

      let canMove = range(1, possibleMoves.length)
        .filter(
          (j) =>
            // not disabled
            !possibleMoves[j - 1].disabled
          // NOTE: we don't actually check for whether we have PP or not because the
          // simulator will mark the move as disabled if there is zero PP and there are
          // situations where we actually need to use a move with 0 PP (Gen 1 Wrap).
        )
        .map((j) => ({
          slot: j,
          move: possibleMoves[j - 1].move,
          target: possibleMoves[j - 1].target,
          zMove: false,
        }));

      if (canZMove) {
        canMove.push(
          ...range(1, active.canZMove.length)
            .filter((j) => active.canZMove[j - 1])
            .map((j) => ({
              slot: j,
              move: active.canZMove[j - 1].move,
              target: active.canZMove[j - 1].target,
              zMove: true,
            }))
        );
      }

      // Filter out adjacentAlly moves if we have no allies left, unless they're our
      // only possible move options.
      const hasAlly =
        pokemon.length > 1 && !pokemon[i ^ 1].condition.endsWith(` fnt`);
      const filtered = canMove.filter(
        (m) => m.target !== `adjacentAlly` || hasAlly
      );
      canMove = filtered.length ? filtered : canMove;

      const moves = canMove.map((m) => {
        // NOTE: We don't generate all possible targeting combinations.
        const target = (() => {
          if (request.active.length > 1) {
            if ([`normal`, `any`, `adjacentFoe`].includes(m.target)) {
              return 1 + Math.floor(this.prng.next() * 2);
            }
            if (m.target === `adjacentAlly`) {
              return ((i ^ 1) + 1) * -1;
            }
            if (m.target === `adjacentAllyOrSelf`) {
              if (hasAlly) {
                return (1 + Math.floor(this.prng.next() * 2)) * -1;
              } else {
                return (i + 1) * -1;
              }
            }
          }
        })();

        const choiceFn = (gimmik?: MoveGimmik) =>
          ProtocolWritter.chooseMove(m.slot, target, gimmik);

        return {
          getChoice: choiceFn,
          move: m,
        };
      });

      const canSwitch = range(1, 6).filter(
        (j) =>
          pokemon[j - 1] &&
          // not active
          !pokemon[j - 1].active &&
          // not chosen for a simultaneous switch
          !chosen.includes(j) &&
          // not fainted
          !pokemon[j - 1].condition.endsWith(` fnt`)
      );
      const switches = active.trapped ? [] : canSwitch;

      if (switches.length && (!moves.length || this.prng.next() > this.move)) {
        const target = this.chooseSwitch(
          active,
          canSwitch.map((slot) => ({ slot, pokemon: pokemon[slot - 1] }))
        );
        chosen.push(target);
        return ProtocolWritter.chooseSwitch(target);
      } else if (moves.length) {
        const { move, getChoice } = this.prng.sample(moves);

        if (move.zMove) {
          canZMove = false;
          return getChoice(MoveGimmik.ZMove);
        } else if (change) {
          if (canTerastallize) {
            canTerastallize = false;
            return getChoice(MoveGimmik.Terastallize);
          } else if (canDynamax) {
            canDynamax = false;
            return getChoice(MoveGimmik.Dynamax);
          } else if (canMegaEvo) {
            canMegaEvo = false;
            return getChoice(MoveGimmik.Mega);
          } else {
            canUltraBurst = false;
            return getChoice(MoveGimmik.UltraBurst);
          }
        } else {
          return getChoice();
        }
      } else {
        throw new Error(
          `${this.constructor.name} unable to make choice ${i}. request='${request}',` +
            ` chosen='${chosen}', (mega=${canMegaEvo}, ultra=${canUltraBurst}, zmove=${canZMove},` +
            ` dynamax='${canDynamax}', terastallize=${canTerastallize})`
        );
      }
    });

    const firstChoice = choices[0];
    const secondChoice = choices[1];

    if (this.nFormat === 1) {
      return firstChoice || ProtocolWritter.choosePass();
    }

    return ProtocolWritter.doublesFormatChoice(
      firstChoice || ProtocolWritter.choosePass(),
      secondChoice || ProtocolWritter.choosePass()
    );
  }

  private handleOtherRequest(request: AnyObject): string {
    return this.chooseTeamPreview(request.side.pokemon);
  }

  protected chooseTeamPreview(_team: AnyObject[]): string {
    return "default";
  }

  protected chooseMove(_active: AnyObject, moves: any[]): string {
    return this.prng.sample(moves).choice;
  }

  protected chooseSwitch(
    _active: AnyObject | undefined,
    switches: { slot: number; pokemon: AnyObject }[]
  ): number {
    return this.prng.sample(switches).slot;
  }
}
