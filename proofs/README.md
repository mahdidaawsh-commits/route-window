# Verified StudioNet execution

One `RouteWindow` instance was deployed to gasless GenLayer StudioNet (chain 61999) at `0x84790519a1E35285A95B43FfD26Ffe77dBF63cf9`. The [deployment manifest](deployment.json) records the pinned bulletin-source commit, SHA-256 hashes, deployed-source byte match, and deploy transaction. The [deploy receipt](main-deploy-receipt.json) and four write receipts show `FINALIZED`, `SUCCESS`, and `MAJORITY_AGREE`. The runner read contract state after every write and compared the event interpretation and complete interval map against the expected result.

| Issue | Source and state | Resulting closed intervals | StudioNet transaction | Full receipt |
| --- | --- | --- | --- | --- |
| 1 — Blue suspension | [manifest](issue-1.json) | Blue `[8,12)` | [tx](https://explorer-studio.genlayer.com/tx/0x7f6372c3efa200935ccc23980c165452f76bf4d3a33d71e6fee912ff9882424a) | [receipt](issue-1-write-receipt.json) |
| 2 — Blue restoration | [manifest](issue-2.json) | Blue `[8,10)`, `[11,12)` | [tx](https://explorer-studio.genlayer.com/tx/0xa80ae654016ac30498def65ceec97746634653357a2fb733509e437a00ee8f48) | [receipt](issue-2-write-receipt.json) |
| 3 — Red delay advisory | [manifest](issue-3.json) | no change | [tx](https://explorer-studio.genlayer.com/tx/0x7d7ea88d8355702d7839c0349b26bd15542f86c74c0c018176736db491781135) | [receipt](issue-3-write-receipt.json) |
| 4 — Red suspension | [manifest](issue-4.json) | Red `[9,11)`; Blue unchanged | [tx](https://explorer-studio.genlayer.com/tx/0x2edec5e455b6a0bc0a0613d3ffd397061ea9f2ba61e937c835bdcd51f1e0c20f) | [receipt](issue-4-write-receipt.json) |

The Blue restoration had three agree votes, one disagree vote, and one idle vote; the other writes had three agree and two idle votes. This is majority consensus, not unanimous inference. Every receipt preserves the actual votes. The final onchain calendar is `Blue:[[8,10],[11,12]]`, `Red:[[9,11]]` relative to `2026-10-03T00:00:00Z`.

The notices are synthetic. These proofs establish contract-side acquisition, semantic consensus, and interval updates, not actual transit service or a Bradbury public-testnet deployment.
