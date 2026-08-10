import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const source = path.join(root, 'vendor', 'dqm1-gb-data')
const outDir = path.join(root, 'src', 'data')
fs.mkdirSync(outDir, { recursive: true })

const hex = (value) => value.toUpperCase().padStart(2, '0')
const normalize = (value) => value.normalize('NFKC').replace(/\s+/g, ' ').trim()

const monsterLines = fs.readFileSync(path.join(source, '00-monster.md'), 'utf8').split(/\r?\n/)
const monsters = []
for (const line of monsterLines) {
  const match = line.match(/^\s*([0-9A-F]{2})\s+(.+?)\s+([0-9A-F]{1,2})\s+(\d+)\s+([0-9A-F]{1,2})\s+([0-9A-F]{1,2})\s+([01])\s+([01])\s+/i)
  if (!match) continue
  monsters.push({
    id: hex(match[1]), name: normalize(match[2]), familyId: hex(match[3]), maxLevel: Number(match[4]),
    expType: hex(match[5]), genderType: hex(match[6]), flying: match[7] === '1', metal: match[8] === '1',
  })
}

const breedingLines = fs.readFileSync(path.join(source, '10-breeding.md'), 'utf8').split(/\r?\n/)
const recipes = []
for (const line of breedingLines) {
  // The trailing Japanese names are a fixed-width display aid and spacing is
  // inconsistent. Parse the six machine-readable columns only, then resolve
  // names from the canonical monster/family tables below.
  const match = line.match(/^\s*(\d+)\s+([0-9A-F]{1,2})\s+([0-9A-F]{1,2})\s+(\d+)\s+([0-9A-F]{1,2})\s+(\d+)\s*(.*)$/i)
  if (!match) continue
  const [, no, m1, m2, pp, mh, bonus] = match
  const lineage = hex(m1)
  const mate = hex(m2)
  const result = hex(mh)
  const lineageRef = lineage.startsWith('F') ? { kind: 'family', id: lineage } : { kind: 'monster', id: lineage }
  const mateRef = mate.startsWith('F') ? { kind: 'family', id: mate } : { kind: 'monster', id: mate }
  const refName = (ref) => ref.kind === 'family' ? `F${ref.id.replace(/^F/, '')}系統` : (monsters.find((m) => m.id === ref.id)?.name ?? `No.${ref.id}`)
  recipes.push({
    sourceNo: Number(no), lineageRef, mateRef, resultId: result, requiredPlus: Number(pp), resultPlusBonus: Number(bonus),
    lineageName: refName(lineageRef), mateName: refName(mateRef), resultName: monsters.find((m) => m.id === result)?.name ?? `No.${result}`,
    recipeKey: `${lineage}|${mate}|${pp}|${result}|${bonus}`,
  })
}

const duplicateGroups = Object.values(recipes.reduce((groups, recipe) => {
  ;(groups[recipe.recipeKey] ??= []).push(recipe.sourceNo)
  return groups
}, {})).filter((sourceNos) => sourceNos.length > 1)
const canonicalRecipes = [...recipes.reduce((groups, recipe) => {
  const existing = groups.get(recipe.recipeKey)
  if (!existing) groups.set(recipe.recipeKey, { ...recipe, sourceNos: [recipe.sourceNo] })
  else {
    existing.sourceNos.push(recipe.sourceNo)
    if (recipe.sourceNo < existing.sourceNo) existing.sourceNo = recipe.sourceNo
  }
  return groups
}, new Map()).values()]

const verifiedSource = JSON.parse(fs.readFileSync(path.join(root, 'vendor', 'verified-recipes.json'), 'utf8'))
if (verifiedSource.unresolved?.length) {
  throw new Error(`Verified recipe source contains ${verifiedSource.unresolved.length} unresolved rows`)
}
const refKey = (ref) => `${ref.kind}:${ref.id}`
const tripleKey = (lineageRef, mateRef, resultId) => `${refKey(lineageRef)}|${refKey(mateRef)}|${resultId}`
const engineByTriple = new Map()
for (const recipe of canonicalRecipes) {
  const key = tripleKey(recipe.lineageRef, recipe.mateRef, recipe.resultId)
  const matches = engineByTriple.get(key) ?? []
  matches.push(recipe)
  engineByTriple.set(key, matches)
}

const verifiedRecipes = verifiedSource.recipes.map((recipe) => {
  const engineMatches = engineByTriple.get(tripleKey(recipe.lineageRef, recipe.mateRef, recipe.resultId)) ?? []
  const engine = engineMatches[0]
  return {
    ...recipe,
    sourceNo: engine?.sourceNo ?? null,
    sourceNos: engineMatches.flatMap((match) => match.sourceNos ?? [match.sourceNo]),
    requiredPlus: engine?.requiredPlus ?? null,
    resultPlusBonus: engine?.resultPlusBonus ?? null,
    engineMatched: Boolean(engine),
  }
})
const orderedPairKey = (lineageRef, mateRef) => `${refKey(lineageRef)}|${refKey(mateRef)}`
const resultsByParents = new Map()
for (const recipe of verifiedRecipes) {
  const key = orderedPairKey(recipe.lineageRef, recipe.mateRef)
  const results = resultsByParents.get(key) ?? new Set()
  results.add(recipe.resultId)
  resultsByParents.set(key, results)
}
for (const recipe of verifiedRecipes) {
  recipe.reverseResultIds = [...(resultsByParents.get(orderedPairKey(recipe.mateRef, recipe.lineageRef)) ?? [])]
  recipe.sameResultWhenReversed = recipe.reverseResultIds.includes(recipe.resultId)
}

const specialMonsterIds = ['D7', 'D8', 'D9', 'DA', 'DB', 'DC']
const nonBreedableMonsterIds = ['08', '4F', '6D', '77', 'AE']
const data = {
  version: 3,
  source: 'ossan-pg/dqm1-gb-data',
  compatibility: 'GB / Dragon Quest Monsters: Terry\'s Wonderland RETRO (normal breeding; communication features excluded)',
  monsters: monsters.map((monster) => ({ ...monster, status: specialMonsterIds.includes(monster.id) ? 'special' : 'playable' })),
  recipes: verifiedRecipes,
  quality: {
    rawEngineRows: recipes.length,
    verifiedDirectionalRecipes: verifiedRecipes.length,
    verifiedResults: new Set(verifiedRecipes.map((recipe) => recipe.resultId)).size,
    sourceNoRange: [0, 824],
    duplicateSourceNos: duplicateGroups,
    specialMonsterIds,
    nonBreedableMonsterIds,
    verification: 'Only ordered recipes independently confirmed by at least two cited GB/RETRO references are shown. Plus values are shown only for an exact ordered match in the ROM-derived engine table.',
    sources: verifiedSource.sources,
  },
  generatedAt: new Date().toISOString(),
}
fs.writeFileSync(path.join(outDir, 'data.json'), JSON.stringify(data, null, 2))
console.log(`Generated ${monsters.length} monsters and ${verifiedRecipes.length} verified directional recipes`)
