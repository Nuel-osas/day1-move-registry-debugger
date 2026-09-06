# How traces work

- The debugger does not attach to a running VM. It replays a recorded trace.
- `sui move test --trace` writes one `.json.zst` per test into `traces/`.
- `sui replay --trace --digest <D>` re-executes the transaction locally against downloaded state and
  writes `.replay/<D>/trace.json.zst` plus `transaction_data.json`, `transaction_effects.json`,
  `move_call_info.json`, and one directory per package touched.
- For source-level stepping on an on-chain trace, copy the package's build output into
  `.replay/<D>/<package_id>/source/`. Bytecode and source must be the same version.
- Supported: breakpoints, step over/into/out, continue, locals (primitives, structs, references),
  PTB command inspection. Not supported: reverse stepping, watchpoints, stepping inside native
  PTB commands. Some locals are optimized away.
- The Homebrew and release binaries have tracing enabled. A source build may not.
