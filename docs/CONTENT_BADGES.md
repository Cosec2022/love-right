# Story content badges

Homepage story cards support two editorial content badges:

- `forbidden-romance` → `禁忌之恋`
- `adult-18-plus` → `18+ 成人限定`

## Recommended catalog fields

Add either a single badge:

```json
{
  "id": "story-05",
  "title": "婚礼前夜，他从雨里回来",
  "contentBadge": "forbidden-romance"
}
```

Or multiple badges:

```json
{
  "id": "story-06",
  "title": "请把门锁上",
  "contentBadges": ["forbidden-romance", "adult-18-plus"],
  "ageRating": "18+"
}
```

The UI also recognizes title prefixes as a migration fallback:

- `【禁忌之恋】...`
- `【成人心动】...`
- `【18+】...`
- `【18禁】...`

When a prefix is used, the homepage renderer moves its meaning into the badge and removes the duplicate prefix from the visible main title.

## Editorial rules

- Keep the main title emotional and readable; use badges for classification.
- Use `18+ 成人限定` only for stories intended exclusively for adults.
- A story can carry both badges when both classifications genuinely apply.
- Do not add either badge to ordinary stories.
