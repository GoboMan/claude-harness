---
paths:
  - "**/*.swift"
---

# 🚦 SwiftUI — how test runs are driven (the simulator is a shared resource)

> **Scope: SwiftUI native iOS apps whose default suite requires a simulator destination to run**
> (running the app target through `xcodebuild test`, and the like).
> Where the default suite closes with `swift test` alone, no exclusivity arises and this document's restrictions do not apply
> (each producer drives itself to green as usual). If you cannot tell, look at the host `CLAUDE.md`'s
> default-suite run command.
>
> **How to write** tests is [testing.md](./testing.md); notation is [coding.md](./coding.md).
> What this document defines is only **who runs the tests, and when**.
>
> **Write reports in Japanese.**

---

## 1. Only one process at a time may take the simulator / build lock

The simulator, DerivedData, and the build lock are **a single shared resource**.
When concurrently launched Tasks each hit them, you get multiple launches, contention over the build, and flakes with no traceable cause —
**and it ends up slower than not parallelizing at all.**

---

## 2. Skip execution inside a concurrent section

- A producer running concurrently **does not run tests** (`xcodebuild test`, a `simctl boot` for testing).
  Stop at editing, type checking, lint, and builds that need no simulator.
- Having skipped, **state explicitly in your report that the tests are unexecuted and which suite (the target feature ID) needs to run.**
  Never silently treat "I could not confirm green myself" as complete.
- **Exception 1: the Red check right after filing** (a selective run of the new tests only) is permitted. The implementers are not running yet
  and the execution fits into a single process, and skipping it would lose the test-first guarantee.
  **You cannot observe other Tasks' execution, so if you cannot tell, go ahead and run** (this moment fits into one process).
- **Exception 2: launching the simulator to check the appearance** (a human gate) is not forbidden.
- Only these 2 exceptions apply; **never widen them at the cost of §1.**

---

## 3. The consolidated run (after the concurrent section closes)

Once the concurrent section closes, **one agent running alone** (relaunching an implementation producer alone is fine) runs them all,
**and settles red/green there.** The Red → Green skipped during the concurrent section closes in this round.

1. **Pin the destination to one.** Declare the device name and OS version in the host's `CLAUDE.md` and use the same one every time.
2. **Reuse an already-booted simulator.** Do not create, delete, or restart one per run.
3. **Never run two `xcodebuild` processes at once** (including multiplying processes via the parallel-test-execution option).
4. During the fix loop, run the selection by feature ID; push full runs to the boundaries (before returning, before commit, in CI).
5. Take red/green from the exit code. **Never hand anything to the next phase with nobody having run it.**

How findings are bundled after a red, and the rework rounds, follow develop skill's rules (not defined here).

---

## ✅ Checklist before returning

- [ ] Did you run tests during a concurrent section? If you skipped, did you say so and name the target suite in your report?
- [ ] Did the consolidated run settle red/green? (are you treating something unexecuted as complete?)
- [ ] Is the destination pinned and matching the declaration in `CLAUDE.md`?
- [ ] Is only one `xcodebuild` running at a time?
