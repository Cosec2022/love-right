# Love Right Story Creation Protocol

This is an execution protocol for making an interactive Love Right story. It is not a product-architecture document.

## Non-negotiable principles

1. Story is the center.
2. Character, plot, and real-world logic outrank personality results.
3. A choice is triggered by the current scene, never by a personality category.
4. A/B/C/D are button positions with no fixed personality meaning.
5. Every choice must still be natural if all personality vectors are deleted.
6. A question need not cover four psychological directions.
7. Eight personality types do not need equal distribution.
8. Never alter character, choice, branch, or ending to improve result shares.
9. A hard choice is an action already taken; it changes facts.
10. Its consequence persists and is later recalled.
11. A soft choice expresses a view, emotion, judgment, or value about this specific event.
12. A soft choice is not a portable psychological questionnaire.
13. Every choice receives an immediate response.
14. Later scenes remember what the player did.
15. Branches may converge; they may not forget.
16. Refusal need not end a story, but renewed development needs a new, credible condition.
17. An ending reflects the whole history, not the last button.
18. Four official endings are four factual futures, not a sweetness scale.
19. A hidden ending is optional.
20. Without an irreplaceable fifth possibility, `hiddenEnding` is `null`.
21. A hidden ending must differ in fact, theme, and aftertaste from every official ending.
22. It rewards recognised, coherent selfhood rather than a score.
23. It is never random, single-choice triggered, or the sole correct ending.
24. Personality results may describe a player; they never direct the story.
25. A Writer cannot approve their own work.
26. Only the Independent Reviewer closes issues and grants Narrative Approved.

## Required sequence

### 1. Story Brief Freezer

Read the existing catalogue and reviews. Identify repeated emotional templates, character templates, overused conflicts, and real situations missing from the catalogue. Propose several concepts, choose by narrative need rather than archetype gap, then freeze a brief: promise, protagonist, love interest, supporting characters, core conflict, reality constraints, 0–6 relationship temperature, prohibited shortcuts, four factual ending directions, and a provisional hidden-ending decision.

The brief cannot be changed later to satisfy measurement or classification.

### 2. Scene-Driven Choice Designer

Design exactly the required slots from scenes rather than a trait grid. For each slot document: current scene, trigger, why now, hard/soft type, what the player must decide, four concrete options, each immediate response, later difference, callback, convergence rule, and preserved history. Hard slots additionally record action, fact/knowledge/relationship changes, persistent consequence, and ending relevance. Soft slots record the event under judgment, four distinct viewpoints, response difference, and callback.

Before prose, check every option: it is possible now; consistent with prior facts; not a generic active/cautious/kind/independent template; meaningful without vectors; immediately answered; and later remembered.

### 3. Writer Brain

Write readable player-facing scenes, all slot options and reactions, bridges, and endings. Keep dialogue character-specific: people may be silent, clumsy, self-interested, evasive, or mistaken. They must not all speak like therapists or product managers. Consent and boundaries remain real; intimacy never overrides earlier refusal. Do not add developer explanations, archetypes, vectors, quota targets, or result-distribution language.

### 4. Outcome and hidden-ending design

Give each official ending an ID, factual final state, relationship state, losses, gains, accumulated hard choices, callbacks, and remaining cost. Confirm that no ending is merely a sweeter or sadder version of another.

Assess a hidden ending separately. It may be designed only when all are true: a fifth factual future exists; it has an independent theme and aftertaste; it recognises a rare, coherent player will; it needs several early choices; and removing it loses an irreplaceable possibility. Otherwise explicitly set `hiddenEnding: null`.

### 5. Independent Reviewer

The reviewer reads the brief, slot map, route/state map, draft, and ending design without writer rationale. They test promise, independent goals, causal continuity, action meaning, immediate response, bridges, time/place, knowledge, temperature, realism, branch memory, hard persistence, soft specificity, generic-template risk, authorial explanation, ending distinction, hidden-ending necessity, history recovery, and final-button override.

They also read adversarial routes: consistently bold, consistently cautious, approach-then-refuse, refuse-then-open, intimacy-without-commitment, affection-without-sacrifice, conceal-then-confess, reality-first, feeling-first, converging histories, shared ending with different histories, and an unexpected mixed route. Each finding includes issue ID, severity P0–P3, location, reproduction route, player action, observed narrative, failure reason, minimal and structural fixes, synchronized locations, acceptance criteria, and `status: open`.

### 6. Revision Controller and loop

The Writer reads only the frozen brief, issue list, reproduction routes, and acceptance criteria. They fix the story rather than explaining it away, record each fix and synchronized location, then return the complete revised work to the Independent Reviewer. The reviewer rereads the whole story, not merely the diff, and alone may resolve, reject, or add issues. Repeat until P0 and P1 are zero. Record residual P2/P3 work explicitly.

### 7. Narrative Approved, then later stages

Only after the reviewer grants Narrative Approved may measurement annotation begin; product runtime integration and release-gate work come later. Neither is part of narrative approval. No result audit, personality quota, or engine concern can reopen frozen story facts merely to improve distribution.
