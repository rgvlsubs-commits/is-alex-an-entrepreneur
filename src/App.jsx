import { useState, useEffect } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

const INITIAL_INVESTMENT = 10000
const START_DATE = '2023-01-03' // First trading day of 2023

// Google stock price on Jan 3, 2023 (first trading day, opening price)
const GOOGLE_START_PRICE = 89.83

// Bitcoin investment details
const BTC_INVESTMENT = 1000
const BTC_INVESTMENT_DATE = '2025-08-15'
const BTC_PRICE_AUG_2025 = 117384.44 // BTC price on Aug 15, 2025

const initialVentures = [
  { id: 1, name: 'Rarely open coffee cart', revenue: 0, expenses: 'Time wasted' },
  { id: 2, name: 'Questionably exploitative house cleaning service', revenue: 0, expenses: 'Online training course' },
  { id: 3, name: 'Vague restaurant/food cart', revenue: 0, expenses: 'Time wasted' },
  { id: 4, name: 'PYOP + Kiln', revenue: 0, expenses: '$100' },
  { id: 5, name: 'CRE Cleaning Franchise (also maybe exploitative)', revenue: 0, expenses: 'Time wasted' },
  { id: 6, name: 'Alarm and security company', revenue: 0, expenses: 'Time wasted' },
  { id: 7, name: 'Wilmington-based landscaping', revenue: 0, expenses: 'Time wasted' },
  { id: 8, name: 'Bitcoin Investor', revenue: 0, expenses: '$1,000', isBitcoin: true },
]

function App() {
  const [ventures, setVentures] = useState(() => {
    const saved = localStorage.getItem('alexVentures_v2')
    if (saved) {
      const parsed = JSON.parse(saved)
      // Ensure Bitcoin venture exists
      if (!parsed.find(v => v.isBitcoin)) {
        parsed.push({ id: 8, name: 'Bitcoin Investor', revenue: 0, expenses: '$1,000', isBitcoin: true })
      }
      return parsed
    }
    return initialVentures
  })
  const [googlePrice, setGooglePrice] = useState(null)
  const [bitcoinPrice, setBitcoinPrice] = useState(null)
  const [bitcoinValue, setBitcoinValue] = useState(null)
  const [googleHistory, setGoogleHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [newVenture, setNewVenture] = useState({ name: '', revenue: 0, expenses: '' })

  // Save ventures to localStorage
  useEffect(() => {
    localStorage.setItem('alexVentures_v2', JSON.stringify(ventures))
  }, [ventures])

  // Fetch Google stock and Bitcoin data
  useEffect(() => {
    fetchGoogleStock()
    fetchBitcoinPrice()
  }, [])

  // Update Bitcoin venture when price changes
  useEffect(() => {
    if (bitcoinValue !== null) {
      setVentures(prev => prev.map(v =>
        v.isBitcoin ? { ...v, revenue: Math.round(bitcoinValue - BTC_INVESTMENT) } : v
      ))
    }
  }, [bitcoinValue])

  const fetchBitcoinPrice = async () => {
    try {
      // Fetch current Bitcoin price from CoinGecko
      const response = await fetch(
        'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd'
      )
      if (!response.ok) throw new Error('Failed to fetch Bitcoin price')

      const data = await response.json()
      const currentPrice = data.bitcoin.usd
      setBitcoinPrice(currentPrice)

      // Calculate current value of $1000 invested at BTC_PRICE_AUG_2025
      const btcAmount = BTC_INVESTMENT / BTC_PRICE_AUG_2025
      const currentValue = btcAmount * currentPrice
      setBitcoinValue(currentValue)
    } catch (err) {
      console.error('Error fetching Bitcoin price:', err)
      // Fallback estimate
      const estimatedPrice = 105000
      setBitcoinPrice(estimatedPrice)
      const btcAmount = BTC_INVESTMENT / BTC_PRICE_AUG_2025
      setBitcoinValue(btcAmount * estimatedPrice)
    }
  }

  const fetchGoogleStock = async () => {
    setLoading(true)
    setError(null)

    // Try multiple data sources for reliability
    const fetchFromYahoo = async () => {
      const endDate = Math.floor(Date.now() / 1000)
      const startDate = Math.floor(new Date(START_DATE).getTime() / 1000)

      const response = await fetch(
        `https://query1.finance.yahoo.com/v8/finance/chart/GOOGL?period1=${startDate}&period2=${endDate}&interval=1mo`
      )

      if (!response.ok) throw new Error('Yahoo Finance failed')

      const data = await response.json()
      const result = data.chart.result[0]
      return {
        timestamps: result.timestamp,
        prices: result.indicators.quote[0].close
      }
    }

    // Alternative: Try via CORS proxy if direct fails
    const fetchViaProxy = async () => {
      const endDate = Math.floor(Date.now() / 1000)
      const startDate = Math.floor(new Date(START_DATE).getTime() / 1000)

      const response = await fetch(
        `https://corsproxy.io/?${encodeURIComponent(`https://query1.finance.yahoo.com/v8/finance/chart/GOOGL?period1=${startDate}&period2=${endDate}&interval=1mo`)}`
      )

      if (!response.ok) throw new Error('Proxy fetch failed')

      const data = await response.json()
      const result = data.chart.result[0]
      return {
        timestamps: result.timestamp,
        prices: result.indicators.quote[0].close
      }
    }

    try {
      let stockData
      try {
        stockData = await fetchFromYahoo()
      } catch (e) {
        console.log('Direct Yahoo failed, trying proxy...')
        stockData = await fetchViaProxy()
      }

      const { timestamps, prices } = stockData

      // Build historical data
      const history = timestamps.map((ts, i) => {
        const date = new Date(ts * 1000)
        const price = prices[i]
        const shares = INITIAL_INVESTMENT / GOOGLE_START_PRICE
        const stockValue = price ? shares * price : null

        return {
          date: date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
          fullDate: date,
          stockValue: stockValue ? Math.round(stockValue) : null,
          alexRevenue: 0 // Always 0 lol
        }
      }).filter(d => d.stockValue !== null)

      setGoogleHistory(history)
      setGooglePrice(prices[prices.length - 1])
      setLoading(false)
    } catch (err) {
      console.error('Error fetching stock data:', err)
      // Fallback: use estimated current price based on recent data
      // GOOGL was ~$197 in Jan 2026
      setGooglePrice(197)
      setError('Could not fetch live data. Using estimated values.')

      // Generate approximate historical data based on actual GOOGL performance
      const months = []
      const startDateObj = new Date(START_DATE)
      const now = new Date()
      let current = new Date(startDateObj)

      // GOOGL went from ~$90 to ~$197 over 3 years (Jan 2023 to Jan 2026)
      // That's roughly 119% gain or about 3.3% per month compounded
      while (current <= now) {
        const monthsElapsed = (current.getFullYear() - startDateObj.getFullYear()) * 12 +
                              (current.getMonth() - startDateObj.getMonth())
        // Use compound growth approximation
        const growthFactor = Math.pow(1.027, monthsElapsed) // ~2.7% monthly to reach ~197 in 36 months
        const stockValue = Math.round(INITIAL_INVESTMENT * growthFactor)

        months.push({
          date: current.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
          fullDate: new Date(current),
          stockValue: stockValue,
          alexRevenue: 0
        })

        current.setMonth(current.getMonth() + 1)
      }

      setGoogleHistory(months)
      setLoading(false)
    }
  }

  // Calculate total revenue (Bitcoin revenue is profit, not total value)
  const totalRevenue = ventures.reduce((sum, v) => {
    if (v.isBitcoin) {
      // For Bitcoin, revenue is already the profit (value - investment)
      return sum + (parseFloat(v.revenue) || 0)
    }
    return sum + (parseFloat(v.revenue) || 0)
  }, 0)

  const shares = INITIAL_INVESTMENT / GOOGLE_START_PRICE
  const currentStockValue = googlePrice ? Math.round(shares * googlePrice) : null
  const stockGain = currentStockValue ? currentStockValue - INITIAL_INVESTMENT : null

  // Format Bitcoin revenue for display
  const getBitcoinRevenueDisplay = (venture) => {
    if (!venture.isBitcoin) return `$${(parseFloat(venture.revenue) || 0).toLocaleString()}`
    if (bitcoinValue === null) return '...'
    const profit = Math.round(bitcoinValue - BTC_INVESTMENT)
    const prefix = profit >= 0 ? '+' : ''
    return `${prefix}$${profit.toLocaleString()}`
  }

  const addVenture = () => {
    if (!newVenture.name.trim()) return
    setVentures([...ventures, {
      id: Date.now(),
      name: newVenture.name,
      revenue: parseFloat(newVenture.revenue) || 0,
      expenses: newVenture.expenses || 'Time wasted'
    }])
    setNewVenture({ name: '', revenue: 0, expenses: '' })
    setShowAddForm(false)
  }

  const deleteVenture = (id) => {
    setVentures(ventures.filter(v => v.id !== id))
  }

  const isEntrepreneur = totalRevenue > 0

  return (
    <div className="app">
      <header>
        <h1>Is Alex an Entrepreneur?</h1>
        <div className={`verdict ${isEntrepreneur ? 'yes' : 'no'}`}>
          {isEntrepreneur ? 'Maybe?' : 'No.'}
        </div>
      </header>

      <main>
        <section className="comparison">
          <h2>The Comparison</h2>
          <p className="subtitle">
            What if Alex had just put $10,000 into Google stock on Jan 1, 2023?
          </p>

          <div className="stats-row">
            <div className="stat-card alex">
              <div className="stat-label">Alex's Total Revenue</div>
              <div className="stat-value">${totalRevenue.toLocaleString()}</div>
              <div className="stat-subtitle">from {ventures.length} ventures</div>
            </div>
            <div className="stat-card vs">VS</div>
            <div className="stat-card google">
              <div className="stat-label">Google Stock Value</div>
              <div className="stat-value">
                {loading ? '...' : `$${currentStockValue?.toLocaleString()}`}
              </div>
              <div className="stat-subtitle gain">
                {stockGain && `+$${stockGain.toLocaleString()} gain`}
              </div>
            </div>
          </div>

          {error && <div className="error-note">{error}</div>}

          <div className="chart-container">
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={googleHistory}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                <XAxis dataKey="date" stroke="#888" fontSize={12} />
                <YAxis stroke="#888" fontSize={12} tickFormatter={(v) => `$${v.toLocaleString()}`} />
                <Tooltip
                  formatter={(value, name) => [`$${value.toLocaleString()}`, name]}
                  contentStyle={{ background: '#1a1a1a', border: '1px solid #333' }}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="stockValue"
                  name="Google Stock Value"
                  stroke="#4285f4"
                  strokeWidth={3}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="alexRevenue"
                  name="Alex's Revenue"
                  stroke="#ea4335"
                  strokeWidth={3}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="difference">
            <span className="label">Opportunity Cost:</span>
            <span className="amount">
              ${stockGain ? (stockGain - totalRevenue).toLocaleString() : '---'}
            </span>
          </div>
        </section>

        <section className="ventures">
          <div className="ventures-header">
            <h2>Alex's Business Ventures</h2>
            <button className="add-btn" onClick={() => setShowAddForm(!showAddForm)}>
              + Enter Another Venture
            </button>
          </div>

          {showAddForm && (
            <div className="add-form">
              <input
                type="text"
                placeholder="Venture name (e.g., 'Artisanal Pickle Stand')"
                value={newVenture.name}
                onChange={(e) => setNewVenture({...newVenture, name: e.target.value})}
              />
              <input
                type="number"
                placeholder="Revenue ($)"
                value={newVenture.revenue || ''}
                onChange={(e) => setNewVenture({...newVenture, revenue: e.target.value})}
              />
              <input
                type="text"
                placeholder="Expenses (e.g., '$50' or 'Time wasted')"
                value={newVenture.expenses}
                onChange={(e) => setNewVenture({...newVenture, expenses: e.target.value})}
              />
              <div className="form-actions">
                <button className="save-btn" onClick={addVenture}>Add Venture</button>
                <button className="cancel-btn" onClick={() => setShowAddForm(false)}>Cancel</button>
              </div>
            </div>
          )}

          <table>
            <thead>
              <tr>
                <th>Business Idea</th>
                <th>Revenue</th>
                <th>Expenses</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {ventures.map(venture => (
                <tr key={venture.id} className={venture.isBitcoin ? 'bitcoin-row' : ''}>
                  <td className="venture-name">
                    {venture.name}
                    {venture.isBitcoin && bitcoinPrice && (
                      <span className="btc-info"> (BTC @ ${bitcoinPrice.toLocaleString()})</span>
                    )}
                  </td>
                  <td className={`revenue ${venture.isBitcoin && venture.revenue >= 0 ? 'positive' : ''}`}>
                    {getBitcoinRevenueDisplay(venture)}
                  </td>
                  <td className="expenses">{venture.expenses}</td>
                  <td className="actions">
                    {!venture.isBitcoin && (
                      <button className="delete-btn" onClick={() => deleteVenture(venture.id)}>×</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td><strong>Total</strong></td>
                <td className="revenue"><strong>${totalRevenue.toLocaleString()}</strong></td>
                <td>Various</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </section>

        <section className="conclusion">
          <h2>Conclusion</h2>
          <p>
            {totalRevenue === 0
              ? `Alex has generated $0 in revenue from ${ventures.length} business ideas. Meanwhile, $10,000 in Google stock would now be worth $${currentStockValue?.toLocaleString() || '---'}. The index fund strategy remains undefeated.`
              : `Alex has generated $${totalRevenue.toLocaleString()} in revenue! Still ${stockGain && stockGain > totalRevenue ? `$${(stockGain - totalRevenue).toLocaleString()} less than` : 'not as good as'} just buying Google stock, but hey, at least there's something.`
            }
          </p>
        </section>
      </main>

      <footer>
        <p>Built with love and a healthy dose of financial reality. Not financial advice.</p>
        <p className="small">Stock data may be delayed or estimated. Past performance does not guarantee future results.</p>
      </footer>
    </div>
  )
}

export default App
