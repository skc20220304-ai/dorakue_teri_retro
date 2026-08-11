import React, { useEffect, useMemo, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { BookOpen, ChevronDown, ChevronUp, Database, ExternalLink, Filter, Heart, RotateCcw, Search, Sparkles, Star, X } from 'lucide-react'
import data from './data/data.json'
import './styles.css'
import { auth, db, doc, firebaseConfigured, getDoc, googleProvider, onAuthStateChanged, setDoc, signInWithPopup, signOut } from './firebase'

const FAMILY_NAMES = { '00': 'スライム系', '01': 'ドラゴン系', '02': 'けもの系', '03': '鳥系', '04': '植物系', '05': '虫系', '06': '悪魔系', '07': 'ゾンビ系', '08': '物質系', '09': '？？？系' }
const FAMILY_ICONS = { '00': '◒', '01': '♢', '02': '♞', '03': '◈', '04': '✦', '05': '✣', '06': '♆', '07': '☠', '08': '⬡', '09': '?' }
const sourceUrl = 'https://github.com/ossan-pg/dqm1-gb-data'

const normalize = (value) => value.normalize('NFKC').toLowerCase().replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60)).trim()
const familyName = (id) => {
  const raw = String(id ?? '').replace(/^F/i, '')
  const key = raw.length === 1 ? raw.padStart(2, '0') : raw.toUpperCase()
  return FAMILY_NAMES[key] ?? '不明な系統'
}
const familyIcon = (id) => FAMILY_ICONS[id] ?? '?'
const monsterById = new Map(data.monsters.map((m) => [m.id, m]))
const playableMonsters = data.monsters.filter((m) => m.status !== 'special')
const recipeResult = (recipe) => monsterById.get(recipe.resultId) ?? { id: recipe.resultId, name: recipe.resultName, familyId: '09' }
const refLabel = (ref, recipe) => ref.kind === 'family' ? familyName(ref.id.replace(/^F/, '')) : (monsterById.get(ref.id)?.name ?? (ref.id === recipe?.mateRef?.id ? recipe.mateName : '不明'))

function readFavorites() {
  try {
    const parsed = JSON.parse(localStorage.getItem('dqm1-favorites-v1') || '{}')
    return { recipes: new Set(Array.isArray(parsed.recipes) ? parsed.recipes : []), monsters: new Set(Array.isArray(parsed.monsters) ? parsed.monsters : []) }
  } catch { return { recipes: new Set(), monsters: new Set() } }
}

function App() {
  const [query, setQuery] = useState(() => new URLSearchParams(window.location.search).get('q') || '')
  const [familyFilter, setFamilyFilter] = useState(() => new URLSearchParams(window.location.search).get('family') || '')
  const [mode, setMode] = useState('result')
  const [selectedId, setSelectedId] = useState('0F')
  const [parentOne, setParentOne] = useState('08')
  const [parentTwo, setParentTwo] = useState('08')
  const [plus, setPlus] = useState('')
  const [page, setPage] = useState('search')
  const [favoriteTab, setFavoriteTab] = useState('recipes')
  const [expandedResults, setExpandedResults] = useState(true)
  const [notice, setNotice] = useState('')
  const [favorites, setFavorites] = useState(readFavorites)
  const [user, setUser] = useState(null)
  const [syncReady, setSyncReady] = useState(!firebaseConfigured)
  const [syncState, setSyncState] = useState(firebaseConfigured ? '未接続' : '端末保存')
  const searchRef = useRef(null)

  useEffect(() => {
    localStorage.setItem('dqm1-favorites-v1', JSON.stringify({ version: 1, recipes: [...favorites.recipes], monsters: [...favorites.monsters], updatedAt: new Date().toISOString() }))
    if (user && db && syncReady) {
      setDoc(doc(db, 'users', user.uid), { recipes: [...favorites.recipes], monsters: [...favorites.monsters], updatedAt: new Date().toISOString() }, { merge: true }).then(() => setSyncState('同期済み')).catch(() => setSyncState('同期失敗'))
    }
  }, [favorites, user, syncReady])
  useEffect(() => {
    if (!auth) return undefined
    return onAuthStateChanged(auth, async (nextUser) => {
      setSyncReady(false)
      setUser(nextUser)
      if (!nextUser || !db) { setSyncState(nextUser ? '未接続' : '未ログイン'); setSyncReady(true); return }
      setSyncState('読み込み中')
      try {
        const snapshot = await getDoc(doc(db, 'users', nextUser.uid))
        if (snapshot.exists()) {
          const remote = snapshot.data()
          setFavorites((current) => ({ recipes: new Set([...(current.recipes ?? []), ...(Array.isArray(remote.recipes) ? remote.recipes : [])]), monsters: new Set([...(current.monsters ?? []), ...(Array.isArray(remote.monsters) ? remote.monsters : [])]) }))
        }
        setSyncReady(true)
        setSyncState('同期済み')
      } catch { setSyncState('同期失敗') }
    })
  }, [])
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    query ? params.set('q', query) : params.delete('q')
    familyFilter ? params.set('family', familyFilter) : params.delete('family')
    window.history.replaceState({}, '', `${window.location.pathname}${params.toString() ? `?${params}` : ''}`)
  }, [query, familyFilter])

  const filteredMonsters = useMemo(() => {
    const q = normalize(query)
    return playableMonsters.filter((monster) => (!q || normalize(monster.name).includes(q)) && (!familyFilter || monster.familyId === familyFilter)).slice(0, 80)
  }, [query, familyFilter])
  const selectedMonster = monsterById.get(selectedId) ?? data.monsters[0]
  const incoming = useMemo(() => data.recipes.filter((r) => r.resultId === selectedMonster?.id), [selectedMonster])
  const outgoing = useMemo(() => data.recipes.filter((r) => r.lineageRef.id === selectedMonster?.id || r.mateRef.id === selectedMonster?.id).slice(0, 20), [selectedMonster])
  const parentResults = useMemo(() => {
    if (mode !== 'parents') return []
    const a = parentOne.toUpperCase(); const b = parentTwo.toUpperCase(); const minPlus = plus === '' ? null : Number(plus)
    const p1Family = monsterById.get(a)?.familyId
    const p2Family = monsterById.get(b)?.familyId
    const refMatches = (ref, exactId, familyId) => ref.kind === 'monster' ? ref.id === exactId : ref.id.replace(/^F/, '') === familyId
    return data.recipes.filter((r) => {
      const direct = refMatches(r.lineageRef, a, p1Family) && refMatches(r.mateRef, b, p2Family)
      return direct && (minPlus === null || (r.requiredPlus !== null && r.requiredPlus <= minPlus))
    })
  }, [mode, parentOne, parentTwo, plus])

  const toggleFavorite = (type, key) => {
    setFavorites((current) => {
      const next = { recipes: new Set(current.recipes), monsters: new Set(current.monsters) }
      const set = next[type]; if (set.has(key)) { set.delete(key); setNotice('お気に入りから解除しました') } else { set.add(key); setNotice('お気に入りに追加しました') }
      window.setTimeout(() => setNotice(''), 2200); return next
    })
  }
  const login = async () => {
    if (!auth || !googleProvider) return setNotice('Firebase設定が未入力です')
    try {
      await signInWithPopup(auth, googleProvider)
    } catch (error) {
      const code = error?.code || ''
      const message = code.includes('popup-blocked')
        ? 'ログイン画面がブロックされました。ブラウザのポップアップを許可してください。'
        : code.includes('unauthorized-domain')
          ? 'この公開ドメインがFirebaseで未承認です。管理者設定を確認してください。'
          : code.includes('cancelled-popup')
            ? 'ログイン画面が閉じられました。もう一度お試しください。'
            : 'ログインに失敗しました。時間を置いて再度お試しください。'
      setNotice(message)
      window.setTimeout(() => setNotice(''), 4200)
    }
  }
  const selectMonster = (id) => { setSelectedId(id); setPage('search'); window.setTimeout(() => document.getElementById('detail-heading')?.focus(), 0) }
  const reset = () => { setQuery(''); setFamilyFilter(''); setMode('result'); setPlus(''); setNotice('検索条件をリセットしました'); searchRef.current?.focus() }
  const favoriteRecipes = data.recipes.filter((r) => favorites.recipes.has(r.recipeKey))
  const favoriteMonsters = playableMonsters.filter((m) => favorites.monsters.has(m.id))

  return <div className="app-shell" style={{ overflowX: 'hidden' }}>
    <header className="topbar">
      <button className="brand" onClick={() => { setPage('search'); setQuery(''); }} aria-label="配合手帳 ホーム"><BookOpen size={34} /><span>配合手帳</span></button>
      <nav className="main-nav" aria-label="メインナビゲーション"><button className={page === 'search' ? 'nav-link active' : 'nav-link'} onClick={() => setPage('search')}><Search size={20} />モンスター検索</button><button className={page === 'favorites' ? 'nav-link active' : 'nav-link'} onClick={() => setPage('favorites')}><Star size={20} />お気に入り</button></nav>
      <div className="account-box">{user ? <><span className="sync-state">{syncState}</span><button className="account-button" onClick={() => signOut(auth)}>{user.displayName || user.email}からログアウト</button></> : firebaseConfigured ? <button className="account-button" onClick={login}>Googleでログインして同期</button> : <span className="sync-state">端末保存</span>}</div><a className="source-link" href={sourceUrl} target="_blank" rel="noreferrer"><Database size={19} />データ出典 <span className="source-name">ossan-pg/dqm1-gb-data</span><ExternalLink size={15} /></a>
    </header>

    {page === 'favorites' ? <FavoritesPage tab={favoriteTab} setTab={setFavoriteTab} recipes={favoriteRecipes} monsters={favoriteMonsters} onRecipe={(recipe) => { setSelectedId(recipe.resultId); setPage('search') }} onMonster={selectMonster} onToggle={toggleFavorite} notice={notice} syncState={syncState} /> : <>
      <main className="workspace">
        <section className="search-hero"><label htmlFor="monster-search" className="sr-only">モンスター名で検索</label><div className="search-input-wrap"><Search size={28} /><input id="monster-search" ref={searchRef} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="モンスター名で検索" autoComplete="off" /></div><span className="search-example">検索例：キングスライム</span></section>
        <div className="mode-tabs" role="tablist" aria-label="配合検索モード"><button role="tab" aria-selected={mode === 'result'} className={mode === 'result' ? 'mode-tab selected' : 'mode-tab'} onClick={() => setMode('result')}>結果から探す</button><button role="tab" aria-selected={mode === 'parents'} className={mode === 'parents' ? 'mode-tab selected' : 'mode-tab'} onClick={() => setMode('parents')}>親から探す</button></div>
        {mode === 'parents' ? <ParentSearch parentOne={parentOne} parentTwo={parentTwo} plus={plus} setParentOne={setParentOne} setParentTwo={setParentTwo} setPlus={setPlus} results={parentResults} onSelect={selectMonster} onToggle={toggleFavorite} favorites={favorites} /> : <div className="three-pane">
          <aside className="filter-panel"><div className="panel-head"><h2><Filter size={18} />フィルター</h2><button className="text-button" onClick={reset}><RotateCcw size={15} />リセット</button></div><fieldset><legend>系統で絞り込む</legend>{Object.entries(FAMILY_NAMES).map(([id, name]) => <label className="check-row" key={id}><input type="radio" name="family" checked={familyFilter === id} onChange={() => setFamilyFilter(id)} /><span className={`family-icon family-${id}`}>{familyIcon(id)}</span><span>{name}</span><small>{data.monsters.filter((m) => m.familyId === id).length}</small></label>)}</fieldset><button className="filter-clear" onClick={() => setFamilyFilter('')}><X size={15} />系統フィルターを解除</button><div className="result-count" aria-live="polite">結果件数：{filteredMonsters.length} 件</div></aside>
          <section className="result-panel" aria-label="モンスター検索結果"><div className="panel-head"><h2>検索結果</h2><span>{filteredMonsters.length} 件</span></div><div className="result-list">{filteredMonsters.length ? filteredMonsters.map((monster) => <button className={monster.id === selectedId ? 'monster-row selected' : 'monster-row'} key={monster.id} onClick={() => selectMonster(monster.id)}><span className={`family-icon family-${monster.familyId}`}>{familyIcon(monster.familyId)}</span><span className="monster-row-copy"><strong>{monster.name}</strong><small>{familyName(monster.familyId)}</small></span><span className="row-star" onClick={(e) => { e.stopPropagation(); toggleFavorite('monsters', monster.id) }} aria-label={favorites.monsters.has(monster.id) ? 'モンスターのお気に入りを解除' : 'モンスターをお気に入りに追加'}><Star size={20} fill={favorites.monsters.has(monster.id) ? 'currentColor' : 'none'} /></span></button>) : <EmptyState message="該当するモンスターがありません" action="検索条件をリセット" onClick={reset} />}</div></section>
          <MonsterDetail monster={selectedMonster} incoming={incoming} outgoing={outgoing} favorites={favorites} onToggle={toggleFavorite} expanded={expandedResults} setExpanded={setExpandedResults} onSelect={selectMonster} />
        </div>}
      </main>
      <footer className="footer"><span>非公式・個人利用</span><span>データ出典：<a href={sourceUrl} target="_blank" rel="noreferrer">ossan-pg/dqm1-gb-data</a></span></footer>
    </>}
    <div className="mobile-nav"><button onClick={() => setPage('search')} className={page === 'search' ? 'active' : ''}><Search size={22} />検索</button><button onClick={() => setPage('favorites')} className={page === 'favorites' ? 'active' : ''}><Star size={22} />お気に入り</button></div>
    <div className="live-region" aria-live="polite">{notice}</div>
  </div>
}

function AcquisitionSection({ monster }) {
  const acquisition = monster.acquisition ?? { doors: [], foreignMaster: null }
  const rules = data.quality.acquisition?.otherCountryMaster
  return <section className="detail-section acquisition-section"><h2>入手方法</h2>{acquisition.doors?.length ? <div><h3>旅の扉</h3>{acquisition.doors.map((door) => <p key={`${door.name}-${door.floors}`}><strong>{door.name}</strong>：{door.floors} <a href={door.sourceUrl} target="_blank" rel="noreferrer">出典</a></p>)}</div> : <p className="muted">掲載された旅の扉出現情報はありません。</p>}{acquisition.foreignMaster && acquisition.foreignMaster.levelBand !== 'なし' ? <div><h3>他国マスター</h3><p><strong>パーティー合計レベル</strong>：{acquisition.foreignMaster.levelBand}</p><p><strong>習得特技</strong>：{acquisition.foreignMaster.skills || 'なし'}</p><a href={acquisition.foreignMaster.sourceUrl} target="_blank" rel="noreferrer">モンスター別の出典</a></div> : null}<p className="muted">他国マスターは、条件達成後に次のフロアへ進むとランダム出現します。{rules?.sourceUrl ? <> <a href={rules.sourceUrl} target="_blank" rel="noreferrer">出現条件一覧</a></> : null}</p></section>
}

function MonsterDetail({ monster, incoming, outgoing, favorites, onToggle, expanded, setExpanded, onSelect }) {
  if (!monster) return <section className="detail-panel"><EmptyState message="モンスターを選択してください" /></section>
  const cannotBreed = data.quality.nonBreedableMonsterIds.includes(monster.id)
  return <section className="detail-panel" aria-labelledby="detail-heading"><div className="detail-header"><div className={`family-icon large family-${monster.familyId}`}>{familyIcon(monster.familyId)}</div><div><h1 id="detail-heading" tabIndex="-1">{monster.name}</h1><p>{familyName(monster.familyId)} <span className="data-no">No. {monster.id}</span></p></div><button className={favorites.monsters.has(monster.id) ? 'favorite-button active' : 'favorite-button'} onClick={() => onToggle('monsters', monster.id)} aria-pressed={favorites.monsters.has(monster.id)}><Star size={20} fill={favorites.monsters.has(monster.id) ? 'currentColor' : 'none'} />{favorites.monsters.has(monster.id) ? 'お気に入り登録済み' : 'モンスターをお気に入り'}</button></div><div className="detail-stats"><span>基本MAX Lv <b>{monster.maxLevel}</b></span><span>{monster.flying ? '飛行タイプ' : '地上タイプ'}</span><span>{monster.metal ? 'メタルタイプ' : '通常タイプ'}</span></div><p className="direction-warning"><strong>順序に注意：</strong>左が血統、右が相手です。左右を入れ替えると結果が変わる場合があります。</p><section className="detail-section"><button className="section-title-button" onClick={() => setExpanded(!expanded)} aria-expanded={expanded}><h2>このモンスターを作る配合</h2>{expanded ? <ChevronUp /> : <ChevronDown />}</button>{expanded && (incoming.length ? incoming.map((recipe) => <RecipeRow key={recipe.recipeKey} recipe={recipe} favorites={favorites} onToggle={onToggle} onSelect={onSelect} highlight />) : <p className="muted">{cannotBreed ? '通常配合では新しく生み出せません。野生・イベント・ボス報酬などで入手します。' : '2資料で一致を確認できた通常配合はありません。'}</p>)}</section><section className="detail-section"><h2>このモンスターを親に使う配合</h2>{outgoing.length ? outgoing.slice(0, 20).map((recipe) => <RecipeRow key={recipe.recipeKey} recipe={recipe} favorites={favorites} onToggle={onToggle} onSelect={onSelect} />) : <p className="muted">該当する配合はありません。</p>}</section></section>
}

const BaseMonsterDetail = MonsterDetail
MonsterDetail = (props) => <div className="detail-stack"><AcquisitionSection monster={props.monster} /><BaseMonsterDetail {...props} /></div>

function RecipeRow({ recipe, favorites, onToggle, onSelect, highlight }) {
  const result = recipeResult(recipe)
  const lineage = recipe.lineageRef.kind === 'family' ? familyName(recipe.lineageRef.id.replace(/^F/, '')) : (monsterById.get(recipe.lineageRef.id)?.name ?? recipe.lineageName)
  const mate = recipe.mateRef.kind === 'family' ? familyName(recipe.mateRef.id.replace(/^F/, '')) : (monsterById.get(recipe.mateRef.id)?.name ?? recipe.mateName)
  const reverseNames = recipe.reverseResultIds.map((id) => monsterById.get(id)?.name ?? `No.${id}`)
  const reverseMessage = recipe.sameResultWhenReversed
    ? '逆順でも同じ結果を確認済み'
    : reverseNames.length
      ? `逆順では「${reverseNames.join('／')}」になる配合を確認済み`
      : '逆順で同じ結果になる配合は2資料では確認できません'
  return <article className={highlight ? 'recipe-row highlight' : 'recipe-row'}><div className="recipe-head"><span>2資料一致</span>{recipe.sourceNo !== null ? <span>内部優先順 {recipe.sourceNo}</span> : null}{recipe.sourceNos?.length > 1 ? <span className="muted">原典重複: No.{recipe.sourceNos.join(' / ')}</span> : null}<span>{recipe.requiredPlus !== null ? <>必要＋値 <b>{recipe.requiredPlus}</b></> : '＋条件は参照元に明記なし'}</span>{recipe.resultPlusBonus ? <span>結果＋{recipe.resultPlusBonus}</span> : null}</div><div className="equation"><button onClick={() => recipe.lineageRef.kind === 'monster' && onSelect(recipe.lineageRef.id)}><small>① 血統（先）</small><strong>{lineage}</strong><em>{recipe.lineageRef.kind === 'family' ? '系統指定' : familyName(monsterById.get(recipe.lineageRef.id)?.familyId)}</em></button><span className="operator">×</span><button onClick={() => recipe.mateRef.kind === 'monster' && onSelect(recipe.mateRef.id)}><small>② 相手（後）</small><strong>{mate}</strong><em>{recipe.mateRef.kind === 'family' ? '系統指定' : familyName(monsterById.get(recipe.mateRef.id)?.familyId)}</em></button><span className="operator arrow">→</span><button className="result-cell" onClick={() => onSelect(recipe.resultId)}><small>結果</small><strong>{result.name}</strong><em>{familyName(result.familyId)}</em></button></div><p className="reverse-note">{reverseMessage}</p><div className="recipe-actions"><span className="recipe-sources">根拠：{recipe.sourceUrls.map((url, index) => <React.Fragment key={url}>{index ? ' / ' : ''}<a href={url} target="_blank" rel="noreferrer">資料{index + 1}</a></React.Fragment>)}</span><button className={favorites.recipes.has(recipe.recipeKey) ? 'recipe-favorite active' : 'recipe-favorite'} onClick={() => onToggle('recipes', recipe.recipeKey)} aria-pressed={favorites.recipes.has(recipe.recipeKey)}><Star size={17} fill={favorites.recipes.has(recipe.recipeKey) ? 'currentColor' : 'none'} />{favorites.recipes.has(recipe.recipeKey) ? 'この配合をお気に入り登録済み' : 'この配合をお気に入り'}</button></div></article>
}

function ParentSearch({ parentOne, parentTwo, plus, setParentOne, setParentTwo, setPlus, results, onSelect, onToggle, favorites }) {
  const options = playableMonsters
  return <section className="parent-search"><div className="parent-intro"><h1>親2体から配合を探す</h1><p><strong>順序は固定です。</strong>左を血統、右を相手として検索します。左右を入れ替えると別の結果になる場合があります。</p></div><div className="parent-controls"><label>① 血統（先に選ぶ親）<select value={parentOne} onChange={(e) => setParentOne(e.target.value)}>{options.map((m) => <option value={m.id} key={m.id}>{m.name}</option>)}</select></label><span className="operator">×</span><label>② 相手（後に選ぶ親）<select value={parentTwo} onChange={(e) => setParentTwo(e.target.value)}>{options.map((m) => <option value={m.id} key={m.id}>{m.name}</option>)}</select></label><label>配合後＋値（任意）<input type="number" min="0" value={plus} onChange={(e) => setPlus(e.target.value)} placeholder="指定なし" /></label></div><div className="parent-results"><div className="panel-head"><h2>配合候補</h2><span>{results.length} 件</span></div>{results.length ? results.map((recipe) => <RecipeRow key={recipe.recipeKey} recipe={recipe} favorites={favorites} onToggle={onToggle} onSelect={onSelect} highlight />) : <EmptyState message="この順序・条件で2資料の一致を確認できた配合はありません" action="血統と相手の順序、＋値を確認してください" />}</div></section>
}

function FavoritesPage({ tab, setTab, recipes, monsters, onRecipe, onMonster, onToggle, syncState }) { return <main className="favorites-page"><div className="favorites-title"><Heart size={34} /><div><h1>お気に入り</h1><p>{syncState === '同期済み' ? 'Firebaseに同期されています' : 'この端末に保存されています'}</p></div></div><div className="favorite-tabs" role="tablist"><button role="tab" aria-selected={tab === 'recipes'} className={tab === 'recipes' ? 'selected' : ''} onClick={() => setTab('recipes')}><Sparkles size={18} />配合 <b>{recipes.length}</b></button><button role="tab" aria-selected={tab === 'monsters'} className={tab === 'monsters' ? 'selected' : ''} onClick={() => setTab('monsters')}><Star size={18} />モンスター <b>{monsters.length}</b></button></div>{tab === 'recipes' ? <div className="favorite-list">{recipes.length ? recipes.map((recipe) => <div className="favorite-item" key={recipe.recipeKey}><RecipeRow recipe={recipe} favorites={{ recipes: new Set([recipe.recipeKey]), monsters: new Set() }} onToggle={onToggle} onSelect={onRecipe} /><button className="outline-button" onClick={() => onRecipe(recipe)}>配合詳細を見る</button></div>) : <EmptyState message="お気に入りの配合はまだありません" action="モンスター検索から星を押して保存" />}</div> : <div className="favorite-monsters">{monsters.length ? monsters.map((monster) => <button className="favorite-monster" key={monster.id} onClick={() => onMonster(monster.id)}><span className={`family-icon family-${monster.familyId}`}>{familyIcon(monster.familyId)}</span><strong>{monster.name}</strong><span>{familyName(monster.familyId)}</span><span className="spacer" /><Star fill="currentColor" size={18} onClick={(e) => { e.stopPropagation(); onToggle('monsters', monster.id) }} /></button>) : <EmptyState message="お気に入りのモンスターはまだありません" action="モンスター検索から星を押して保存" />}</div>}<p className="storage-note">{syncState === '同期済み' ? 'ログイン中のアカウントに保存されています。別端末でも同じアカウントでログインしてください。' : 'お気に入りはこの端末のブラウザに保存されます。Firebase設定後、Googleログインで別端末と同期できます。'}</p></main> }
function EmptyState({ message, action, onClick }) { return <div className="empty-state"><p>{message}</p>{action && <button onClick={onClick}>{action}</button>}</div> }

createRoot(document.getElementById('root')).render(<App />)
