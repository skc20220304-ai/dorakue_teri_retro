import test from 'node:test'
import assert from 'node:assert/strict'
import data from '../src/data/data.json' with { type: 'json' }

test('generated data contains the expected core tables', () => {
  assert.equal(data.version, 4)
  assert.ok(data.monsters.length >= 200)
  assert.equal(data.recipes.length, 952)
  assert.equal(new Set(data.monsters.map((monster) => monster.id)).size, data.monsters.length)
  assert.equal(new Set(data.recipes.map((recipe) => recipe.recipeKey)).size, data.recipes.length)
  assert.ok(data.recipes.every((recipe) => recipe.recipeKey && recipe.resultId && recipe.verificationStatus === 'verified-two-sources'))
  assert.ok(data.recipes.every((recipe) => recipe.lineageRef?.kind && recipe.lineageRef?.id && recipe.mateRef?.kind && recipe.mateRef?.id))
  assert.ok(data.recipes.every((recipe) => recipe.requiredPlus === null || Number.isInteger(recipe.requiredPlus)))
  assert.equal(data.quality.verifiedResults, 210)
  assert.deepEqual(data.quality.nonBreedableMonsterIds, ['08', '4F', '6D', '77', 'AE'])
})

test('previously missing breedable monsters are covered with ordered recipes', () => {
  const expected = [
    ['F0', 'B9', '10'], ['10', '10', '11'], ['31', 'F1', '35'], ['F2', '1C', '44'],
    ['F2', '87', '45'], ['F6', 'F2', '8B'], ['F8', 'F4', 'B3'],
  ]
  for (const [lineageId, mateId, resultId] of expected) {
    assert.ok(data.recipes.some((recipe) => recipe.lineageRef.id === lineageId && recipe.mateRef.id === mateId && recipe.resultId === resultId), `${lineageId} x ${mateId} -> ${resultId}`)
  }
})

test('Golden Golem recipe preserves bloodline and mate direction', () => {
  assert.ok(data.recipes.some((recipe) => recipe.lineageRef.id === 'C1' && recipe.mateRef.id === 'C0' && recipe.resultId === 'C7'))
  assert.ok(!data.recipes.some((recipe) => recipe.lineageRef.id === 'C0' && recipe.mateRef.id === 'C1' && recipe.resultId === 'C7'))
})

test('acquisition data includes doors and foreign-master bands', () => {
  const slime = data.monsters.find((monster) => monster.name === 'スライム')
  assert.ok(slime.acquisition.doors.some((door) => door.name === 'たびだちのとびら'))
  const metal = data.monsters.find((monster) => monster.name === 'メタルスライム')
  assert.match(metal.acquisition.foreignMaster.levelBand, /〜/)
  assert.ok(data.quality.acquisition.otherCountryMaster.conditions.length >= 5)
})

test('event-only acquisition records include Watabou and the other event recruits', () => {
  const eventNames = ['スカイドラゴン', 'うごくせきぞう', 'スライム', 'わたぼう']
  for (const name of eventNames) {
    const monster = data.monsters.find((entry) => entry.name === name)
    assert.ok(monster?.acquisition?.event, `${name} should have an event acquisition record`)
  }
  const watabou = data.monsters.find((entry) => entry.name === 'わたぼう')
  assert.match(watabou.acquisition.event.timing, /旅の扉/)
  assert.match(watabou.acquisition.event.location, /牧舎/)
})
