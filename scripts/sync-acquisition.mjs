import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const data = JSON.parse(fs.readFileSync(path.join(root, 'src', 'data', 'data.json'), 'utf8'))
const normalize = (value) => value.replace(/&nbsp;/g, ' ').replace(/&#039;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/<br\s*\/?\s*>/gi, ' ').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
const hrefFrom = (value) => value.match(/href=["']([^"']+)["']/i)?.[1] ?? null
const section = (html, heading) => {
  const start = html.search(new RegExp(`<h[23][^>]*>\\s*${heading}\\s*</h[23]>`, 'i'))
  if (start < 0) return ''
  const rest = html.slice(start)
  const end = rest.search(/<h[23][^>]*>/i)
  return end > 0 ? rest.slice(0, end) : rest
}
const rowsFrom = (html) => {
  const table = html.match(/<table[\s\S]*?<\/table>/i)?.[0] ?? ''
  return [...table.matchAll(/<tr[\s\S]*?<\/tr>/gi)].map((row) => [...row[0].matchAll(/<t[hd][^>]*>[\s\S]*?<\/t[hd]>/gi)].map((cell) => ({ text: normalize(cell[0]), href: hrefFrom(cell[0]) }))).filter((row) => row.length >= 2)
}
const aliases = new Map([
  ['りゅうおう（１形態）', 'りゅうおう'], ['りゅうおう（２形態）', 'りゅうおう（変身）'],
  ['ミルドラース（１形態）', 'ミルドラース'], ['ミルドラース（２形態）', 'ミルドラース（変身）'],
  ['デスタムーア（１形態）', 'デスタムーア'], ['デスタムーア（２形態）', 'デスタムーア（変身）'],
  ['デスタムーア（３形態）', 'デスタムーア（最終）'], ['デスタムーア（変身）', 'デスタムーア（変身）'], ['デスタムーア（最終）', 'デスタムーア（最終）'],
])
const keyName = (value) => aliases.get(value.normalize('NFKC').trim()) ?? value.normalize('NFKC').trim()
const byName = new Map(data.monsters.map((m) => [keyName(m.name), m]))
const records = {}
const unresolved = []
for (let page = 1; page <= 12; page += 1) {
  const response = await fetch(`https://jippe-game.com/terryretro/wp-json/wp/v2/posts?per_page=100&page=${page}`)
  if (!response.ok) break
  const posts = await response.json()
  for (const post of posts) {
    const title = normalize(post.title?.rendered ?? '')
    const articleName = title.match(/】(.+?)の配合方法/)?.[1]?.trim() ?? ''
    const match = data.monsters.find((m) => keyName(m.name) === keyName(articleName) || keyName(articleName) === keyName(m.name))
    if (!match || !post.content?.rendered || !/出現する扉/.test(post.content.rendered)) continue
    const html = post.content.rendered
    const doors = rowsFrom(section(html, '出現する扉')).slice(1).map((r) => ({ name: r[0].text, floors: r[1].text, sourceUrl: r[0].href ? new URL(r[0].href, post.link).href : post.link })).filter((r) => r.name && !/なし|特になし/.test(r.name))
    const masterRows = rowsFrom(section(html, '他国マスターデータ'))
    const foreignMaster = masterRows.length > 1 ? { levelBand: masterRows[1][0].text, skills: masterRows[1][1].text, sourceUrl: post.link } : null
    records[match.id] = { doors, foreignMaster, sourceUrl: post.link }
  }
}
for (const monster of data.monsters.filter((m) => m.status === 'playable')) if (!records[monster.id]) unresolved.push({ id: monster.id, name: monster.name })
const output = { version: 1, policy: 'Jippe GB/RETRO対応の各モンスター記事から、旅の扉の出現階数と他国マスターのレベル帯を抽出。掲載のない個体は空欄とする。', source: 'https://jippe-game.com/terryretro/', records, unresolved }
fs.writeFileSync(path.join(root, 'vendor', 'acquisition.json'), JSON.stringify(output, null, 2))
console.log(JSON.stringify({ records: Object.keys(records).length, unresolved: unresolved.length, sample: records['08'] }, null, 2))
