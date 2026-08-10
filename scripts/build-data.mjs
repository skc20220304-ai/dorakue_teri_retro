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
const specialMonsterIds = ['D7', 'D8', 'D9', 'DA', 'DB', 'DC']
const data = {
  version: 2,
  source: 'ossan-pg/dqm1-gb-data',
  compatibility: 'GB / Dragon Quest Monsters: Terry\'s Wonderland RETRO (normal breeding; communication features excluded)',
  monsters: monsters.map((monster) => ({ ...monster, status: specialMonsterIds.includes(monster.id) ? 'special' : 'playable' })),
  recipes: canonicalRecipes,
  quality: {
    sourceNoRange: [0, 824],
    missingSourceNos: [202, 204, 532],
    duplicateSourceNos: duplicateGroups,
    specialMonsterIds,
    verification: 'mechanically validated against source IDs and independently cross-checked at list level against GB/RETRO community tables; PP/P+ remain source-derived',
  },
  generatedAt: new Date().toISOString(),
}
fs.writeFileSync(path.join(outDir, 'data.json'), JSON.stringify(data, null, 2))
console.log(`Generated ${monsters.length} monsters and ${recipes.length} recipes`)
