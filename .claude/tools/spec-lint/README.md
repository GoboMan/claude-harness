# spec-lint

A zero-dependency Node tool bundled with the harness that mechanically verifies the format and
lifecycle of the docs SSOT (the ledger, feature specs, contracts).

- **The layout it verifies**: `docs/specs/specs.md` (the ledger) + `docs/specs/F-xxx-<slug>/` (`spec.md`, `api-contract.yaml`) + `docs/specs/_shared/components.yaml`. If `docs/PRD.md` / `docs/design.md` exist, it also warns on boundary violations (GWT leaking into the PRD, and the like)
- **The format it verifies**: the SSOT is the templates in `../../templates/develop/`. The required sections and frontmatter of spec.md and the required `x-` keys of a contract are **derived from the templates** (revise the format by editing the template and the lint follows; the judgment rules for how to write are held by each producer's craft)
- **Scope of contract (OpenAPI 3.1) verification**: the lifecycle (`x-status`), ID consistency (directory name ↔ `x-feature-id`), resolution of `x-spec` and `$ref`, and cross-checking against the spec. **Full OpenAPI syntax validation is the producer's job via `npx @redocly/cli lint` or similar** (a division of labor that keeps this tool dependency-free)
- **How it is used**: producers (contract-author and others) invoke it directly to machine-verify their deliverables. Wiring `gate` into a commit-msg hook is also possible (optional, on each project's side)

```bash
node spec-lint.mjs validate [--docs docs]     # format + state-machine invariants + docs hygiene
node spec-lint.mjs gate --message <file>       # verify a commit's Feature: trailer
node spec-lint.mjs gate --feature F-001         # whether the given feature's spec / contract are fixed
```

Exit codes: `0`=OK / `1`=violation / `2`=usage error. Node only (no external dependencies).
On detecting the old layout (`docs/spec` + `docs/contracts`), it prompts for migration and returns `1`.

## What it treats as an error (state-machine and reference invariants)

- Missing required frontmatter / required sections / required `x-` keys; a status other than `draft|fixed`
- Directory-name violations of `F-xxx-<slug>`, mismatched or duplicate feature IDs, a missing `spec.md`
- Inconsistency with the ledger (missing entries, broken links, conflicting status)
- A contract that is `fixed` while its parent spec is `draft`; placeholders left behind on something `fixed`
- An `x-spec` or `$ref` reference that does not resolve

## Docs-hygiene detection (all warnings)

Warns on signs that a spec or contract is drifting from "present-tense invariants" into a dumping
ground for information (the SSOT for the negative lists is each producer's craft — the "what must not
be written" sections of ssot-definer / contract-author):

| Detection | Target | What it means |
| --- | --- | --- |
| Accumulated blockquotes at the top | spec | Revision history and diff narrative belong in the commit message / ADR |
| Dates in parentheses in the body (`（2026-01-01` and the like) | spec / contract | git holds the history. Integrate the body into the present tense |
| Implementation anchors (code file paths; for contracts, only with line numbers) | spec / contract | The code is the SSOT. Written into docs, it rots |
| Internal API references (`Class::method`) | spec | A spec is written in the vocabulary of observable behavior |
| A "known issues / residual risks / backlog" section | spec | Open items are pushed out to issue tracking (never let them accumulate in a fixed spec) |
| Bloat (a spec over 12,000 characters / a contract over 400 lines) | spec / contract | Suspected accumulation beyond one concern. **A spec is measured in characters, not lines** (a real case: a spec with 1,000-character lines slipped under the threshold at "300 lines") |
| Over 30 business rules | spec | The substance of a spec (invariants, one rule per sentence). Too many suggests the feature is too large |
| A single business rule over 150 characters | spec | It is not one rule per sentence (several rules compressed into one). A cap on the count alone can be dodged by paragraphing, so length is checked too |
| Over 15 acceptance criteria | spec | Acceptance criteria are representative examples supplementing the rules, **not a list of test cases** (exhausting the cases is test-designer's job; one rule → N tests is the healthy ratio). A swelling count means paraphrased rules, enumerated value variants, or one line accumulated per defect |
| Over 20 references to other features | spec | Suspected duplication of the referenced behavior. Shared behavior is held only by the owning feature's spec; the rest keep to a one-line reference |
| Type, required, or constraint columns in the input table | spec | Type information is authoritative in the contract. A spec's inputs are "name \| business meaning" only |
| `x-*` restating business rules (state-transition and the like) | contract | Rules and evaluation order belong to the spec. A contract holds only the shape of the boundary |
| A long `description` (over 8 lines / over 200 characters) | contract | Purpose, rules, and UI explanations belong to the spec. Only a one-line summary and short notes here |
| GWT / acceptance criteria in the PRD | PRD | Per-feature acceptance criteria are the spec's concern (a boundary violation) |

Why these are not errors: so that an existing project's `validate` does not die instantly (cleanup happens
progressively, at the opportunities differential updates provide).
