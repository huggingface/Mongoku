type HintResult = { hits: Array<string>; miss: Array<string> };

class HintManager {

    private readonly hints: Map<string, string>;

    constructor() {
        this.hints = new Map<string, string>();
    }

    save(hint: string, value?: string) {
        if (!hint || !value) return;
        this.hints.set(hint, value);
    }

    tryApplyHint(hint: string, universe: Array<string>): HintResult {
        if (!hint) return { hits:[], miss: universe };

        const value = this.hints.get(hint);
        if (!value) return { hits:[], miss: universe };

        const [hits, miss] = universe
          .reduce(([p, f], e) => (e === value ? [[...p, e], f] : [p, [...f, e]]), [[], []]);

        return { hits, miss };
    }
}

export const Hint = new HintManager();
