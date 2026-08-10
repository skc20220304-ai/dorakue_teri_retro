import test from 'node:test'
import assert from 'node:assert/strict'
import data from '../src/data/data.json' with { type: 'json' }

test('generated data contains the expected core tables', () => {
  assert.equal(data.version, 3)
  assert.ok(data.monsters.length >= 200)
  assert.equal(data.recipes.length, 934)
  assert.equal(new Set(data.monsters.map((monster) => monster.id)).size, data.monsters.length)
  assert.equal(new Set(data.recipes.map((recipe) => recipe.recipeKey)).size, data.recipes.length)
  assert.ok(data.recipes.every((recipe) => recipe.recipeKey && recipe.resultId && recipe.verificationStatus === 'verified-two-sources'))
  assert.ok(data.recipes.every((recipe) => recipe.lineageRef?.kind && recipe.lineageRef?.id && recipe.mateRef?.kind && recipe.mateRef?.id))
  assert.ok(data.recipes.every((recipe) => recipe.requiredPlus === null || Number.isInteger(recipe.requiredPlus)))
  assert.equal(data.quality.verifiedResults, 194)
})

test('Golden Golem recipe preserves bloodline and mate direction', () => {
  assert.ok(data.recipes.some((recipe) => recipe.lineageRef.id === 'C1' && recipe.mateRef.id === 'C0' && recipe.resultId === 'C7'))
  assert.ok(!data.recipes.some((recipe) => recipe.lineageRef.id === 'C0' && recipe.mateRef.id === 'C1' && recipe.resultId === 'C7'))
})
