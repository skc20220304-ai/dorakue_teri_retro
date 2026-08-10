import test from 'node:test'
import assert from 'node:assert/strict'
import data from '../src/data/data.json' with { type: 'json' }

test('generated data contains the expected core tables', () => {
  assert.equal(data.version, 3)
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
