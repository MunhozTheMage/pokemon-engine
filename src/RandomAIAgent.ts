import { ObjectReadWriteStream } from "@pkmn/sim/build/cjs/lib/streams";
import BattleAgent from "./BattleAgent";
import ProtocolWritter, {
  MoveGimmik,
  NPokemonsFormat,
  PlayerSide,
} from "./ProtocolWritter";
import { AnyObject, PRNG, PRNGSeed } from "@pkmn/sim";
import { range } from "./helpers/array.helper";

export default class RandomAIAgent extends BattleAgent {
  protected readonly move: number;
  protected readonly mega: number;
  protected readonly prng: PRNG;
  protected readonly nFormat: Exclude<NPokemonsFormat, 3>;

  constructor(
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

    super(playerStream);
    this.nFormat = options.nFormat || 1;
    this.move = options.move || 1.0;
    this.mega = options.mega || 0;
    this.prng =
      options.seed && !Array.isArray(options.seed)
        ? options.seed
        : new PRNG(options.seed);
  }

  protected processRequest(request: AnyObject): string | undefined {
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

    return ProtocolWritter.join(
      ...[firstChoice, secondChoice].map((choice) => {
        if (!choice) return ProtocolWritter.choosePass();
        return ProtocolWritter.chooseSwitch(choice);
      })
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

    return ProtocolWritter.join(
      firstChoice || ProtocolWritter.choosePass(),
      secondChoice || ProtocolWritter.choosePass()
    );
  }

  private handleOtherRequest(_request: AnyObject): string {
    return "default";
  }

  protected chooseSwitch(
    switches: { slot: number; pokemon: AnyObject }[]
  ): number {
    return this.prng.sample(switches).slot;
  }
}
