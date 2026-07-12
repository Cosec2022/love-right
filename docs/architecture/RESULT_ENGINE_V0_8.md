# Result Engine v0.8

v0.8 separates measurement from interpretation. `ProfileBuilder` converts answers into a 16-axis profile, exposure, context profiles, variance, consistency, trend and interaction. An unobserved axis has reliability `0`; its numeric fallback is never treated as evidence.

`ArchetypeClassifier` compares only observed, reliable axes against one global, versioned model. It has no story outcomes or narrative copy. `OutcomeResolver` reads only the terminal choice/outcome and flags; personality classification cannot alter a story ending.

Each story may declare which axes it measures, but may not supply its own archetype centers, bias or gates. The global v2 model is the sole classification semantic source. Legacy per-story classification remains behind a migration boundary until every story is migrated, then is deleted.

Audit is deterministic: a fixed seed drives route sampling and the default command writes no tracked file. During migration, health indicators are reachability, unique archetypes, top share, entropy, deterministic-route diversity and stability. The temporary Story 03 v2 baseline is unique >= 6/8, top share <= 55%, normalized entropy >= .62 and deterministic diversity >= 3/4. These are migration guardrails, not a product requirement that every archetype must be uniformly distributed.

`storyContractVersion` is independent from result `modelVersion`. Contract v2 choices explicitly declare hard factual actions or soft scene-bound perspectives; invalid v2 contracts fail rather than falling back to legacy. A/B/C/D have no personality meaning, and v2 forbids personality quota fields.

V2 profile evidence is primarily explicit soft scene evidence. Hard evidence enters only when `stableMeaning` is declared and its reliability is capped. Unobserved axes have value 0 only as serialization placeholder, with exposure and reliability 0; observed neutral evidence remains distinguishable. Outcome and hidden-ending data never enter a profile. Profile evidence describes what the player expressed in the story; it is never manufactured to fill archetype distribution gaps.
