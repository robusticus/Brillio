import { useEffect, useRef, useState, type FormEvent } from 'react'



type Listing = {
  relevanceScore?: number
  id: string; source: string; address: string; city: string; state: string; zip: string;
  price: number; bedrooms: number; bathrooms: number; sqft: number; latitude: number;
  longitude: number; listedDate: string; status: 'active' | 'pending' | 'sold'; description: string
}
const currency = new Intl.NumberFormat('en-US', {style:'currency', currency:'USD', maximumFractionDigits:0})
type SortOrder = 'relevance' | 'price' | 'listedDate'

function ListingRow({listing, hasKeyword}: {listing: Listing; hasKeyword: boolean}) {
  const [dismissed, setDismissed] = useState(false)
  const score = listing.relevanceScore?.toFixed(4)
  const fields = [
    ['ID / source', listing.id + ' / ' + listing.source],
    ['Price', currency.format(listing.price)], ['Status', listing.status],
    ['Beds / baths', listing.bedrooms + ' / ' + listing.bathrooms],
    ['Area', listing.sqft.toLocaleString('en-US') + ' ft²'], ['Date listed', listing.listedDate],
    ['Lat / long', listing.latitude + ', ' + listing.longitude],
    ...(hasKeyword && score ? [['Relevance score', score]] : [])
  ]
  const tooltipId = 'details-' + listing.id
  return <tr className={dismissed ? 'dismissed' : ''} tabIndex={0} aria-describedby={tooltipId}
    onMouseEnter={() => setDismissed(false)} onFocus={() => setDismissed(false)}
    onKeyDown={event => {if (event.key === 'Escape') setDismissed(true)}}>
    <td><strong>{listing.address}</strong>
      <div role="tooltip" id={tooltipId} className="listing-tooltip">
        <div className="tooltip-summary">
          <strong>{listing.address}, {listing.city}, {listing.state} {listing.zip}</strong>
          <p>{listing.description}</p>
        </div>
        {[fields.slice(0, -3), fields.slice(-3)].map(group => (
          <dl key={group[0][0]}>
            {group.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
          </dl>
        ))}
      </div>
    </td>
    <td>{currency.format(listing.price)}</td><td>{listing.bedrooms}</td>
    {hasKeyword && <td>{score}</td>}
    <td>{listing.description}</td>
  </tr>
}

export default function App() {
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(5)
  const [sortOverride, setSortOverride] = useState<SortOrder | null>(null)
  const [request, setRequest] = useState({query:''})
  const [rows, setRows] = useState<Listing[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const form = useRef<HTMLFormElement>(null)
  useEffect(() => {
    const controller = new AbortController()
    async function load() {
      try {
        const res = await fetch('/api/listings?' + request.query, {signal: controller.signal})
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Search failed.')
        setRows(data.items)
      } catch (e) {
        if (!controller.signal.aborted) setError(e instanceof Error && !(e instanceof SyntaxError) ? e.message : 'Unable to reach the listing API.')
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }
    void load()
    return () => controller.abort()
  }, [request])
  function run(query: string) {
    setPage(1)
    setLoading(true)
    setError('')
    if (!new URLSearchParams(query).has('q') && sortOverride === 'relevance') setSortOverride(null)
    setRequest({query})
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const params = new URLSearchParams()
    for (const [key,value] of new FormData(event.currentTarget)) {
      if (typeof value === 'string' && value.trim()) params.set(key,value.trim())
    }
    run(params.toString())
  }
  const hasKeyword = new URLSearchParams(request.query).has('q')
  const sortOrder = sortOverride ?? (hasKeyword ? 'relevance' : 'listedDate')
  // The API already ranks keyword matches by descending relevance.
  const sortedRows = sortOrder === 'relevance' ? rows : [...rows].sort((a, b) =>
    sortOrder === 'price' ? a.price - b.price : b.listedDate.localeCompare(a.listedDate)
  )
  const pageCount = Math.ceil(sortedRows.length / pageSize)
  const offset = (page - 1) * pageSize
  const visibleRows = sortedRows.slice(offset, offset + pageSize)
  return <>
    <header><div className="brand"><span aria-hidden="true">▦</span> Brillio</div><small>Property listings</small></header>
    <main><h1>Listing search</h1>
    <form ref={form} onSubmit={submit}>
      <div className="filters">
        <label>Min price (USD)<input type="number" min="0" step="1000" name="minPrice" placeholder="No minimum"/></label>
        <label>Max price (USD)<input type="number" min="0" step="1000" name="maxPrice" placeholder="No maximum"/></label>
        <label>Min bedrooms<input type="number" min="0" step="1" name="minBedrooms" placeholder="Any number"/></label>
        <label>City<input name="city" placeholder="Any city"/></label>
      </div>
      <label htmlFor="keyword">Keyword</label>
      <div className="query">
        <input id="keyword" name="q" placeholder="Try “fenced yard” or “community pool”" type="search"/>
        <button type="submit">Search listings</button>
      </div>
    </form>
    <section aria-labelledby="results"><div className="resultbar"><h2 id="results">Results <span aria-live="polite">{loading || error ? '' : rows.length}</span></h2>
      <label className="sort">Sort by
        <select value={sortOrder} onChange={event => {
          setSortOverride(event.target.value as SortOrder)
          setPage(1)
        }}>
          <option value="relevance" disabled={!hasKeyword}>Relevance</option>
          <option value="price">Lowest Price</option>
          <option value="listedDate">Date Listed</option>
        </select>
      </label>
      <button className="clear" onClick={()=>{form.current?.reset();setSortOverride(null);run('')}}>Clear filters</button></div>
    {loading ? <p role="status">Searching listings…</p> : error ? <p role="alert">{error}</p> : !rows.length ? <p role="status">No listings match your search. Try a broader description or clear your filters.</p> :
    <div className="listing-grid"><table aria-label="Listing results">
      <thead><tr><th>Address</th><th>Price</th><th>Bedrooms</th>{hasKeyword && <th>Relevance score</th>}<th>Description</th></tr></thead>
      <tbody>{visibleRows.map(listing => <ListingRow key={listing.id} listing={listing} hasKeyword={hasKeyword}/>)}</tbody>
    </table></div>}
    {!loading && !error && rows.length > 0 && <nav className="pagination" aria-label="Listing pages">
      <label>Listings per page
        <select value={pageSize} onChange={event => {
          setPageSize(Number(event.target.value))
          setPage(1)
        }}>
          <option value={5}>5</option>
          <option value={10}>10</option>
        </select>
      </label>
      <button disabled={page === 1} onClick={() => setPage(page - 1)}>Previous</button>
      <span aria-live="polite">Page {page} of {pageCount}</span>
      <button disabled={page >= pageCount} onClick={() => setPage(page + 1)}>Next</button>
    </nav>}
    </section></main></>
}
