<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Project docs

- **Implementation conventions, RLS, phases:** [`docs/IMPLEMENTATION_REFERENCE.md`](docs/IMPLEMENTATION_REFERENCE.md)
- **Product / UX:** [`PRODUCT_REQUIREMENTS.md`](PRODUCT_REQUIREMENTS.md)

## Workflow rules

- **Do NOT commit docs until approved:** Specs, design docs, and implementation plans must NOT be committed to git until the user has explicitly reviewed and approved them. Write them to disk first, ask for review, and only commit after receiving confirmation.

## graphify

This project has a knowledge graph at `graphify-out/`. Keep it current with `graphify watch .`.

For codebase questions, first run `graphify query "<question>" --budget 1200` when `graphify-out/graph.json` exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph (capped at 1200 tokens), usually much smaller than `GRAPH_REPORT.md` or raw grep.

- Dirty `graphify-out/` files are expected after hooks or incremental updates; do not skip graphify because of that.
- If `graphify-out/wiki/index.md` exists, use it for broad navigation instead of raw source browsing.
- Read `graphify-out/GRAPH_REPORT.md` only for broad architecture review or when query/path/explain do not surface enough context.
- Do not run `graphify update .` after every edit — `graphify watch` and the git hooks rebuild the AST graph. Run it only if watch is not running or `graphify-out/needs_update` exists.

