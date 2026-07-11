import { readFile, writeFile } from "node:fs/promises";
import { StoryEngine } from "../public/app/engine/story-engine.js";
import { ScoreEngine } from "../public/app/engine/score-engine.js";
import { ResultEngine } from "../public/app/engine/result-engine.js";

const catalog = JSON.parse(await readFile(new URL("../public/stories/catalog.json", import.meta.url), "utf8"));
const memoryStore = () => ({ load: () => null, save: () => {}, clear: () => {} });
const reports = [];

const preferred = {
  "story-01": { s08_name: "a", s10_confession: "c", s12_cancel: "b", s16_missing: "b" },
  "story-02": { s09: "b", s13: "b", s15: "a" },
  "story-03": { s09: "c", s13: "a", s16: "c" },
  "story-04": { s08: "b", s13: "a", s15: "a" },
  "story-05": { s08: "a", s10: "a", s13: "a", s15: "a" },
  "story-06": { s07: "a", s08: "b", s10: "a", s13: "a", s15: "b" }
};

for (const entry of catalog.stories.filter((item) => item.status === "published")) {
  const story = JSON.parse(await readFile(new URL(`../public/${entry.storyUrl.replace(/^\.\//, "")}`, import.meta.url), "utf8"));
  const results = JSON.parse(await readFile(new URL(`../public/${entry.resultsUrl.replace(/^\.\//, "")}`, import.meta.url), "utf8"));
  const engine = new StoryEngine(story, { store: memoryStore() });
  engine.start();
  const transitions = [];
  while (!engine.state.complete) {
    const scene = engine.getCurrentScene();
    const wanted = preferred[story.id]?.[scene.id];
    const choice = scene.choices.find((item) => item.id === wanted) ?? scene.choices[1] ?? scene.choices[0];
    const source = scene.id;
    engine.choose(choice.id);
    if (!engine.state.complete && choice.aftermath) {
      const next = engine.getCurrentScene();
      transitions.push({
        from: source,
        choice: choice.text,
        aftermath: next.content[0]?.type === "continuity" ? next.content[0].text : null,
        to: next.id
      });
    }
  }
  const result = new ResultEngine(story, results, new ScoreEngine(story)).build(engine.state);
  reports.push({
    storyId: story.id,
    title: story.metadata.title,
    result: result.memory.title,
    outcome: engine.state.outcome,
    relationship: engine.state.relationship,
    transitions
  });
}

await writeFile(new URL("../docs/generated/emotional-self-review.json", import.meta.url), JSON.stringify(reports, null, 2) + "\n");
console.log(JSON.stringify(reports, null, 2));
