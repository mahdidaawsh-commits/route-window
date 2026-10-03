# RouteWindow

**A consensus calendar for published route disruptions.** RouteWindow converts a bounded sequence of natural-language operator bulletins into an hourly closure calendar. It is an event-sourced interval engine, not a graph-transition proposal, certificate, auction, or release checklist.

The caller supplies a SHA-256 digest and commit-pinned URL inside the contract's fixed bulletin repository. The leader fetches the full document and extracts `CLOSE`, `RESTORE`, or `NONE`, exact affected routes, and the UTC window. Validators independently fetch and hash the same bytes, then judge every consequential field against the full bulletin. Only an agreed extraction can alter state. A closure unions intervals; a restoration subtracts its interval; an advisory does nothing. Anyone can read the resulting schedule and the source-linked event log.

The constructor fixes a repository, UTC origin, 1–168-hour horizon, and 1–6 route names. `ingest_bulletin(url, sha256)` is permissionless but accepts only the next numbered file from that repository, at a 40-character Git commit. The limit is 12 bulletins per calendar. A failed fetch, hash mismatch, invalid extraction, or consensus disagreement leaves the previous calendar untouched. The operator repository is a trust boundary: the contract verifies what its published notices say, not what physically happened on a route.

```text
Published bulletin → independently fetched bytes → semantic field consensus
                   → interval union/subtraction → queryable closure calendar
```

The supplied bulletins are **synthetic**. They demonstrate a full suspension, a one-hour restoration that splits a closure, a delay-only advisory with no calendar effect, and an independent second-route suspension. They do not assert that a real transit operator issued these notices or that trains actually ran.

## Interface

| Method | Effect |
| --- | --- |
| `constructor(source_repo, origin_utc, horizon_hours, routes_json)` | Fix authority, time horizon and routes |
| `ingest_bulletin(url, digest)` | Fetch, verify, interpret, reach consensus and apply next notice |
| `get_schedule()` | Return closed half-open hourly intervals by route |
| `get_bulletin(issue)` | Return immutable source, extraction and resulting schedule hash |

The contract makes no payments and accepts no secrets. It does not infer opening hours outside the specified horizon, actual route operation, future bulletin truth, or public-agency authority. For production, deployers should choose a repository operated by the source they intend to follow and a horizon appropriate to its notices. See [design](docs/design.md), [tests](tests/direct/test_window.py), and [StudioNet proofs](proofs/README.md).

## Reproduce

```sh
pip install -r requirements.txt
genvm-lint download --version v0.2.16
genvm-lint check contracts/route_window.py --json
pytest tests/direct/ -q
```

The first source line pins a concrete GenVM runner. `genlayer deploy` uses `deploy/00_route_window.js` and the documented `ROUTEWINDOW_*` environment variables. StudioNet is gasless (chain 61999). The proof runner checks `FINALIZED`, successful execution, validator majority, deployed source bytes, bulletin digests, and onchain state after each event.
