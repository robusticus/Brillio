// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import App from './App'

const listings = Array.from({ length: 12 }, (_, index) => ({
  id: String(index + 1), source: 'Test MLS', address: (index + 1) + ' Test Lane',
  city: 'Vienna', state: 'VA', zip: '22180', price: 400000, bedrooms: 2,
  bathrooms: 1, sqft: 950, latitude: 38.9, longitude: -77.2,
  listedDate: '2026-09-' + String(index + 1).padStart(2, '0'),
  status: 'active', description: 'Test listing'
}))

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

it.each([5, 10])('pages through the full result set and back with %i listings per page', async size => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ items: listings, total: listings.length })))
  render(<App/>)

  const table = await screen.findByRole('table', { name: 'Listing results' })
  const select = screen.getByRole<HTMLSelectElement>('combobox', { name: 'Listings per page' })
  const previous = screen.getByRole<HTMLButtonElement>('button', { name: 'Previous' })
  const next = screen.getByRole<HTMLButtonElement>('button', { name: 'Next' })
  expect(select.value).toBe('5')
  if (size === 10) fireEvent.change(select, { target: { value: '10' } })

  // The fixture arrives oldest first. The default display order is newest first.
  const expected = listings.map(listing => listing.address).reverse()
  const pageCount = Math.ceil(expected.length / size)
  function checkPage(page: number) {
    expect(screen.getByText('Page ' + page + ' of ' + pageCount)).toBeTruthy()
    expect(previous.disabled).toBe(page === 1)
    expect(next.disabled).toBe(page === pageCount)
    const addresses = within(table).getAllByRole('row').slice(1).map(row =>
      within(row).getAllByRole('cell')[0].querySelector('strong')?.textContent
    )
    expect(addresses).toEqual(expected.slice((page - 1) * size, page * size))
    return addresses
  }

  const visited = checkPage(1)
  for (let page = 2; page <= pageCount; page++) {
    fireEvent.click(next)
    visited.push(...checkPage(page))
  }
  expect(visited).toEqual(expected)
  for (let page = pageCount - 1; page >= 1; page--) {
    fireEvent.click(previous)
    checkPage(page)
  }
})
