import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { StoryEngine } from '../public/app/engine/story-engine.js';

const story = JSON.parse(await readFile(new URL('../public/stories/story-08/story.json', import.meta.url), 'utf8'));
const memory = () => ({ load: () => null, save: () => {}, clear: () => {} });
const textOf = (scene) => scene.content.map((item) => item.text).join(' ');

function play(picks = {}) {
  const engine = new StoryEngine(story, { store: memory() });
  engine.start();
  const scenes = [];
  let guard = 0;
  while (!engine.state.complete && guard < 40) {
    const scene = engine.getCurrentScene();
    scenes.push(structuredClone(scene));
    const choiceId = picks[scene.id] ?? picks[`slot${scene.slot}`] ?? 'a';
    const choice = scene.choices.find((item) => item.id === choiceId);
    assert.ok(choice, `${scene.id}: missing requested choice ${choiceId}`);
    engine.choose(choice.id);
    guard += 1;
  }
  assert.equal(engine.state.complete, true);
  assert.equal(engine.state.answers.length, 18);
  return { engine, scenes };
}

const sceneById = (id) => {
  const scene = story.scenes.find((item) => item.id === id);
  assert.ok(scene, id);
  return scene;
};

test('story 08 keeps eighteen decisions while giving consequential moments real branches', () => {
  assert.equal(new Set(story.scenes.map((scene) => scene.slot)).size, 18);
  assert.equal(story.scenes.length, 29);
  assert.deepEqual(
    new Set(sceneById('s04').choices.map((choice) => choice.next)),
    new Set(['s05_boundary', 's05_open', 's05_refuse', 's05_present'])
  );
  assert.equal(sceneById('s08').choices[0].next, 's09_close');
  assert.equal(sceneById('s08').choices[3].next, 's09_distance');
  for (const id of ['s16_postpone', 's16_24h', 's16_cancel', 's16_conceal']) {
    assert.equal(sceneById(id).decisionType, 'hard');
  }
});

test('the four slot-five routes are genuinely different and contain no developer commentary', () => {
  const ids = ['s05_boundary', 's05_open', 's05_refuse', 's05_present'];
  const bodies = ids.map((id) => textOf(sceneById(id)));
  assert.equal(new Set(bodies).size, 4);
  const allVisible = story.scenes.flatMap((scene) => [
    ...scene.content.map((item) => item.text),
    ...(scene.variants ?? []).flatMap((variant) => [
      ...(variant.content ?? []).map((item) => item.text),
      ...(variant.prependContent ?? []).map((item) => item.text),
      ...(variant.appendContent ?? []).map((item) => item.text)
    ]),
    ...scene.choices.flatMap((choice) => [choice.text, choice.aftermath ?? '', choice.subtext ?? ''])
  ]).join('\n');
  for (const phrase of ['你此前的选择改变了', '事情仍然发生', '完全相同的语气', '许妍', '工作台被加固', '最后一班渡船']) {
    assert.equal(allVisible.includes(phrase), false, phrase);
  }
});

test('refusing the meeting, bridge and explanation remains coherent without forcing physical proximity', () => {
  const { engine, scenes } = play({
    s01: 'b', s02: 'c', s03: 'b', s04: 'b', s05_open: 'c', s06: 'd', s07: 'b',
    s08: 'd', s09_distance: 'd', s10: 'b', s11: 'b', s12: 'c', s13: 'd', s14: 'c',
    s15: 'c', s16_cancel: 'b', s17_unbound: 'c', s18_distance: 'd'
  });
  const visited = new Set(scenes.map((scene) => scene.id));
  assert.equal(visited.has('s05_open'), true);
  assert.equal(visited.has('s09_distance'), true);
  assert.equal(visited.has('s05_boundary'), false);
  assert.equal(visited.has('s09_close'), false);
  assert.match(textOf(scenes.find((scene) => scene.id === 's07')), /扫描件|附页/);
  assert.doesNotMatch(textOf(scenes.find((scene) => scene.id === 's06')), /叫住他|桥下/);
  assert.equal(engine.state.flags.kiss_state, 'none');
  assert.equal(engine.state.outcome, 'distance');
});

test('an earlier approach does not make a later refusal disappear', () => {
  const { scenes, engine } = play({
    s01: 'a', s02: 'a', s03: 'a', s04: 'a', s05_boundary: 'a', s06: 'a', s07: 'a',
    s08: 'a', s09_close: 'c', s10: 'a', s11: 'd', s12: 'a', s13: 'c', s14: 'a',
    s15: 'a', s16_postpone: 'a', s17_unbound: 'b', s18_commute: 'a'
  });
  const s10 = scenes.find((scene) => scene.id === 's10');
  assert.match(textOf(s10), /没有第二次试探/);
  assert.doesNotMatch(textOf(s10), /刚才那个吻|你主动结束那个吻/);
  assert.equal(engine.state.flags.kiss_state, 'refused');
  assert.equal(engine.state.outcome, 'commute');
});

test('asking about consequences does not silently become consent to a kiss', () => {
  const { scenes, engine } = play({
    s01: 'd', s02: 'd', s03: 'c', s04: 'd', s05_present: 'd', s06: 'b', s07: 'd',
    s08: 'b', s09_close: 'd', s10: 'd', s11: 'a', s12: 'b', s13: 'a', s14: 'd',
    s15: 'b', s16_24h: 'c', s17_unbound: 'a', s18_return: 'b'
  });
  const s10 = scenes.find((scene) => scene.id === 's10');
  assert.match(textOf(s10), /吻没有发生/);
  assert.equal(engine.state.flags.kiss_state, 'clarify');
  assert.equal(engine.state.outcome, 'return');
});

test('Xu Cheng receives route-specific truth and a lie leaves a later cost', () => {
  const { scenes, engine } = play({
    s01: 'a', s02: 'a', s03: 'a', s04: 'a', s05_boundary: 'b', s06: 'a', s07: 'd',
    s08: 'a', s09_close: 'a', s10: 'a', s11: 'a', s12: 'd', s13: 'c', s14: 'b',
    s15: 'd', s16_conceal: 'd', s17_married: 'a', s18_commute: 'c'
  });
  assert.match(textOf(scenes.find((scene) => scene.id === 's15')), /这句话不是真的|为什么选择说谎/);
  assert.match(textOf(scenes.find((scene) => scene.id === 's17_married')), /仍不知道完整事实/);
  assert.equal(engine.state.flags.truth_to_xucheng, 'lied');
  assert.equal(engine.state.flags.wedding_decision, 'continued_hidden');
  assert.equal(engine.state.outcome, 'commute');
});

test('a kiss can be real without forcing reunion or another relationship', () => {
  const { engine } = play({
    s01: 'a', s02: 'b', s03: 'd', s04: 'c', s05_refuse: 'a', s06: 'c', s07: 'c',
    s08: 'a', s09_close: 'b', s10: 'd', s11: 'c', s12: 'a', s13: 'b', s14: 'b',
    s15: 'c', s16_cancel: 'a', s17_unbound: 'b', s18_commute: 'd'
  });
  assert.equal(engine.state.flags.kiss_state, 'initiated');
  assert.equal(engine.state.flags.wedding_decision, 'relationship_paused');
  assert.equal(engine.state.outcome, 'commute');
});

test('the final meaning choice cannot rewrite the factual ending branch', () => {
  const expected = {
    s18_return: 'return',
    s18_commute: 'commute',
    s18_distance: 'distance',
    s18_farewell: 'farewell'
  };
  for (const [sceneId, outcome] of Object.entries(expected)) {
    const finalScene = sceneById(sceneId);
    assert.equal(finalScene.decisionType, 'final');
    assert.equal(new Set(finalScene.choices.map((choice) => choice.outcome)).size, 1);
    assert.equal(finalScene.choices[0].outcome, outcome);
    assert.equal(finalScene.choices.every((choice) => choice.next === '$result'), true);
  }
});
