import test from 'node:test'
import assert from 'node:assert/strict'
import data from '../src/data/data.json' with { type: 'json' }

test('generated data contains the expected core tables', () => {
  assert.ok(data.monsters.length >= 200)
  assert.ok(data.recipes.length >= 800)
  assert.equal(new Set(data.monsters.map((monster) => monster.id)).size, data.monsters.length)
  assert.ok(data.recipes.every((recipe) => recipe.recipeKey && recipe.resultId && Number.isInteger(recipe.requiredPlus)))
})
