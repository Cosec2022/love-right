# Love Right Commercial v1

## Scope

- Love ID + nickname login. No password, recovery secret, email, phone, or community/social graph.
- A Love ID plus its exact nickname is the intentionally low-security credential. The interface warns users not to use real names or sensitive identifiers.
- A private Love Profile stores verified story completions and cross-story trait summaries.
- One thumbs-up/down vote per completed story per Love ID; the vote can be changed or withdrawn.
- Stories with at least 7 votes rank by approval rate, then vote count, then freshness. Stories below 7 votes rank newest first.
- Every story keeps its four factual narrative endings. A separate global set of 16 four-character identity labels appears under “你是一个怎样的人”.
- Donation opens a configured hosted payment page. Love Right stores no payment credentials.
- Community, public profile, comments, follows, DMs, subscription, and paywalls are outside this release.

## Sixteen-label model

The public labels are independent from the legacy eight detailed archetypes. They are derived deterministically from four shared axes in the 16-dimensional result space:

- `care` — 照顾倾向, threshold 57
- `expression` — 表达直接, threshold 61
- `idealization` — 浪漫投射, threshold 53
- `validation` — 被选需求, threshold 54

The four high/low signals form 16 unique combinations and therefore 16 labels. There is no random assignment and no runtime quota. Calibration used random routes across all 13 published stories. `npm run audit:commercial` requires all 16 labels to be reachable and blocks release if one label exceeds 16% of the sample.

The older `npm run audit` still audits the legacy eight-archetype explanation layer. Several existing stories naturally concentrate there, so this legacy audit remains available as editorial debt but is not the Commercial v1 deployment gate. The public four-character labels do not inherit that concentration.

## Verified completion flow

The browser submits only the story ID and the ordered 18-choice path. The Worker reloads the published story package, replays every choice, rebuilds the narrative outcome, detailed archetype, 16D traits, and four-character label, and only then stores the completion. Client-supplied labels or trait values are not trusted.

## Data model

- `users`: Love ID and nickname.
- `sessions`: opaque browser sessions, stored as SHA-256 token hashes, expiring after 180 days.
- `completions`: verified result timeline and trait snapshots.
- `story_votes`: unique `(love_id, story_id)` vote.

## Privacy boundary

This release intentionally has no email, phone, password recovery, public profile, follower, comment, DM, or community table. Anyone who knows both the Love ID and exact nickname can enter the same archive. The product must keep this warning visible.

## Donation

Set Wrangler variable `DONATION_URL` to a hosted payment page. When it is empty, the result page shows “打赏即将开放” and no payment is attempted.

## Release commands

```bash
npm run check
npm run db:migrate:remote
npm run deploy
```
