import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const data = JSON.parse(fs.readFileSync(path.join(root, 'src/data/data.json'), 'utf8'))
const monsters = data.monsters.filter((monster) => monster.status === 'playable')
const byName = new Map(monsters.map((monster) => [monster.name, monster]))
const aliases = new Map([
  ['獣系', 'けもの系'], ['鳥系', 'とり系'], ['植物系', 'しょくぶつ系'], ['虫系', 'むし系'], ['悪魔系', 'あくま系'], ['物質系', 'ぶっしつ系'],
  ['キラーマシン', 'キラーマシーン'], ['ミステリドール', 'ミステリードール'], ['かりゅうそう', 'かりゅそう'],
  ['デッドペッカー', 'デッドベッカー'], ['おおにわとり', 'おおにわとり'], ['ローズバトラー', 'ローズバトラー'],
  ['サボテンボール', 'サバテンボール'], ['ウィングスネーク', 'ウイングスネーク'], ['ギガンテス', 'ギガンデス'], ['パオーム', 'バオーム'],
  ['りゅうおう', 'りゅうおう1'], ['りゅうおう(DRAGON)', 'りゅうおう2'],
  ['りゅうおう（１形態）', 'りゅうおう1'], ['りゅうおう（２形態）', 'りゅうおう2'],
  ['ミルドラース', 'ミルドラース1'], ['ミルドラース(変身)', 'ミルドラース2'],
  ['ミルドラース（１形態）', 'ミルドラース1'], ['ミルドラース（２形態）', 'ミルドラース2'],
  ['デスタムーア', 'デスタムーア1'], ['デスタムーア(変身)', 'デスタムーア2'], ['デスタムーア(最終)', 'デスタムーア3'],
  ['デスタムーア（変身）', 'デスタムーア2'], ['デスタムーア（最終）', 'デスタムーア3'],
  ['デスタムーア（１形態）', 'デスタムーア1'], ['デスタムーア（２形態）', 'デスタムーア2'], ['デスタムーア（３形態）', 'デスタムーア3'],
])
const familyIds = new Map([
  ['スライム系', 'F0'], ['ドラゴン系', 'F1'], ['けもの系', 'F2'], ['とり系', 'F3'], ['しょくぶつ系', 'F4'],
  ['むし系', 'F5'], ['あくま系', 'F6'], ['ゾンビ系', 'F7'], ['ぶっしつ系', 'F8'], ['？？？？系', 'F9'], ['？？？系', 'F9'],
])

const decode = (text) => text
  .replace(/&nbsp;|&#160;/g, ' ')
  .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
  .replace(/&#(\d+);/g, (_, value) => String.fromCodePoint(Number(value)))

const plain = (html) => decode(html)
  .replace(/<br\s*\/?\s*>/gi, '\n')
  .replace(/<[^>]+>/g, '')
  .replace(/\r/g, '')
  .trim()

const values = (html) => plain(html).split(/\n+/).map((value) => value.trim()).filter(Boolean)
  .flatMap((value) => value.includes('＋') ? [value.split('＋').at(-1).trim()] : [value])
  .filter((value) => value !== '（なし）' && value !== '(なし)')

const normalizeName = (name) => aliases.get(name) ?? name
const toRef = (raw) => {
  const name = normalizeName(raw)
  if (familyIds.has(name)) return { kind: 'family', id: familyIds.get(name), name }
  const monster = byName.get(name)
  return monster ? { kind: 'monster', id: monster.id, name: monster.name } : null
}

const rows = (table) => [...table.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)].map((match) =>
  [...match[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((cell) => cell[1]))

const keyOf = (lineage, mate, resultId) => `${lineage.kind}:${lineage.id}|${mate.kind}:${mate.id}|${resultId}`
const unresolved = []

async function fetchJson(url) {
  const response = await fetch(url, { headers: { 'user-agent': 'dqm1-breeding-notebook data verification' } })
  if (!response.ok) throw new Error(`${response.status} ${url}`)
  return response.json()
}

async function fetchText(url) {
  const response = await fetch(url, { headers: { 'user-agent': 'dqm1-breeding-notebook data verification' } })
  if (!response.ok) throw new Error(`${response.status} ${url}`)
  return response.text()
}

async function loadJippe() {
  const posts = []
  for (let page = 1; page <= 5; page += 1) {
    const batch = await fetchJson(`https://jippe-game.com/terryretro/wp-json/wp/v2/posts?per_page=100&page=${page}`)
    posts.push(...batch)
  }
  const recipes = new Map()
  for (const post of posts.filter((item) => /配合方法.*ステータス/.test(item.title.rendered))) {
    const title = plain(post.title.rendered)
    const resultName = normalizeName(title.match(/】(.+?)の配合方法/)?.[1] ?? '')
    const result = byName.get(resultName)
    const content = post.content.rendered
    const start = content.indexOf('配合での作り方')
    const sectionEnd = content.indexOf('<h2', start + 5)
    const section = content.slice(start, sectionEnd > start ? sectionEnd : undefined)
    const tableMatch = section.match(/<table[^>]*>([\s\S]*?)<\/table>/i)
    if (!result || start < 0 || !tableMatch) {
      unresolved.push({ source: 'jippe', title, reason: !result ? 'unknown result' : 'missing recipe table' })
      continue
    }
    for (const cells of rows(tableMatch[0])) {
      if (cells.length !== 2) continue
      const lineages = values(cells[0]).map(toRef).filter(Boolean)
      const mates = values(cells[1]).map(toRef).filter(Boolean)
      for (const lineage of lineages) for (const mate of mates) {
        const key = keyOf(lineage, mate, result.id)
        recipes.set(key, { lineageRef: lineage, mateRef: mate, resultId: result.id, resultName: result.name, sourceUrl: post.link })
      }
    }
  }
  return recipes
}

async function loadXgame() {
  const recipes = new Map()
  for (let family = 1; family <= 11; family += 1) {
    const url = `https://xgamemania.com/dq/monsters_gb/mix/${family}.html`
    const html = await fetchText(url)
    const table = html.match(/<table class="ta1"[\s\S]*?<\/table>/i)?.[0]
    if (!table) throw new Error(`missing table ${url}`)
    let currentResult = null
    for (const cells of rows(table)) {
      if (cells.length === 3) currentResult = byName.get(normalizeName(values(cells[0])[0] ?? '')) ?? null
      if (cells.length < 2 || !currentResult) continue
      const lineageCell = cells.at(-2)
      const mateCell = cells.at(-1)
      const lineages = values(lineageCell).map(toRef).filter(Boolean)
      const mates = values(mateCell).map(toRef).filter(Boolean)
      for (const lineage of lineages) for (const mate of mates) {
        const key = keyOf(lineage, mate, currentResult.id)
        recipes.set(key, { lineageRef: lineage, mateRef: mate, resultId: currentResult.id, resultName: currentResult.name, sourceUrl: url })
      }
    }
  }
  return recipes
}

const [jippe, xgame] = await Promise.all([loadJippe(), loadXgame()])
const verified = []
for (const [key, recipe] of jippe) {
  const second = xgame.get(key)
  if (!second) continue
  verified.push({
    recipeKey: `verified|${key}`,
    lineageRef: recipe.lineageRef,
    mateRef: recipe.mateRef,
    resultId: recipe.resultId,
    resultName: recipe.resultName,
    requiredPlus: 0,
    resultPlusBonus: 0,
    direction: 'ordered',
    verificationStatus: 'verified-two-sources',
    sourceUrls: [recipe.sourceUrl, second.sourceUrl],
  })
}

const curatedTwoSourceRecipes = [
  ['スライム系', 'メタルドラゴン', 'メタルスライム', 'https://jippe-game.com/terryretro/monster-metalslime/', 'https://jony-webcreat.com/teriwanretoro/monster/metalslime/'],
  ['メタルスライム', 'メタルスライム', 'はぐれメタル', 'https://jippe-game.com/terryretro/monster-metalbabble/', 'https://jony-webcreat.com/teriwanretoro/monster/haguremetal/'],
  ['ミノーン', 'ドラゴン系', 'アントベア', 'https://jippe-game.com/terryretro/monster-tonguebear/', 'https://jony-webcreat.com/teriwanretoro/monster/antbear/'],
  ['けもの系', 'ドラゴン', 'キラーパンサー', 'https://jippe-game.com/terryretro/monster-great-sabrecat/', 'https://jony-webcreat.com/teriwanretoro/monster/killerpanther/'],
  ['けもの系', 'おおめだま', 'ビックアイ', 'https://jippe-game.com/terryretro/monster-bigeye/', 'https://jony-webcreat.com/teriwanretoro/monster/bigeye/'],
  ['あくま系', 'けもの系', 'グレムリン', 'https://jippe-game.com/terryretro/monster-gremlin/', 'https://jony-webcreat.com/teriwanretoro/monster/glemlin/'],
  ['ぶっしつ系', 'しょくぶつ系', 'トーテムキラー', 'https://jippe-game.com/terryretro/monster-teaky-mask/', 'https://jony-webcreat.com/teriwanretoro/monster/totemkiller/'],
]
for (const [lineageName, mateName, resultName, firstUrl, secondUrl] of curatedTwoSourceRecipes) {
  const lineageRef = toRef(lineageName)
  const mateRef = toRef(mateName)
  const result = byName.get(resultName)
  if (!lineageRef || !mateRef || !result) throw new Error(`Unresolved curated recipe: ${lineageName} x ${mateName} -> ${resultName}`)
  const key = keyOf(lineageRef, mateRef, result.id)
  if (verified.some((recipe) => recipe.recipeKey === `verified|${key}`)) continue
  verified.push({
    recipeKey: `verified|${key}`,
    lineageRef,
    mateRef,
    resultId: result.id,
    resultName: result.name,
    requiredPlus: 0,
    resultPlusBonus: 0,
    direction: 'ordered',
    verificationStatus: 'verified-two-sources',
    sourceUrls: [firstUrl, secondUrl],
  })
}
verified.sort((a, b) => a.resultId.localeCompare(b.resultId) || a.recipeKey.localeCompare(b.recipeKey))
const countResults = (collection, resultId) => [...collection.values()].filter((recipe) => recipe.resultId === resultId).length
const unverifiedResults = monsters.map((monster) => ({
  id: monster.id,
  name: monster.name,
  jippe: countResults(jippe, monster.id),
  xgame: countResults(xgame, monster.id),
  verified: verified.filter((recipe) => recipe.resultId === monster.id).length,
})).filter((result) => result.verified === 0)

const output = {
  version: 1,
  generatedAt: new Date().toISOString(),
  policy: 'Only directional recipes confirmed by at least two independent GB/RETRO references are included.',
  sources: ['https://jippe-game.com/terryretro/', 'https://xgamemania.com/dq/monsters_gb/mix/11.html', 'https://jony-webcreat.com/teriwanretoro/monster/all-monster-making/'],
  stats: { jippe: jippe.size, xgame: xgame.size, verified: verified.length, unresolved: unresolved.length },
  unresolved,
  unverifiedResults,
  recipes: verified,
}
fs.writeFileSync(path.join(root, 'vendor/verified-recipes.json'), JSON.stringify(output, null, 2))
console.log(JSON.stringify(output.stats))
