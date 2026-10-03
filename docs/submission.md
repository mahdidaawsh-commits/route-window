Contribution type: Builder / Intelligent Contracts
Contribution date: 10/02/2026
Title: RouteWindow: Consensus disruption calendar

Notes / Description:

RouteWindow is an event-sourced GenLayer disruption calendar. A deployer fixes source, routes and horizon. Anyone submits the next sequential commit-pinned bulletin URL and SHA-256. The leader fetches the full text and extracts CLOSE, RESTORE or NONE, affected routes and exact hour interval. Validators independently re-fetch and hash the text, then assess every consequential field, including omitted routes and absence of hidden suspensions. Agreed CLOSE unions intervals; RESTORE subtracts; delay-only NONE preserves the calendar. Each event records its source, interpretation and resulting schedule hash. Gasless StudioNet proofs show a Blue closure, a restoration splitting it, a Red delay advisory with no schedule change, and a separate Red closure. Four MAJORITY_AGREE writes match onchain interval reads. The repo includes 10 direct tests and full receipts. Synthetic notices demonstrate published schedule interpretation, not actual train operation.

Evidence:
- https://github.com/mahdidaawsh-commits/route-window
- https://github.com/mahdidaawsh-commits/route-window/blob/main/contracts/route_window.py
- https://github.com/mahdidaawsh-commits/route-window/blob/main/proofs/README.md
- https://github.com/mahdidaawsh-commits/route-window/blob/main/docs/design.md
