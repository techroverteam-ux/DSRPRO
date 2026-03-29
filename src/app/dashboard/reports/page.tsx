'use client'
import { useState, useEffect } from 'react'
import { Download, FileText, TrendingUp, Calendar, Calculator } from 'lucide-react'
import { toast } from 'react-hot-toast'
import { format } from 'date-fns'
import { useLanguage } from '@/components/LanguageProvider'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { TableSkeleton } from '@/components/ui/skeleton'
import { DatePicker } from '@/components/ui/date-picker'
import { FilterPanel, FilterButton } from '@/components/ui/filter-panel'

function formatAED(value: number): string {
  if (value >= 1_000_000_000) return `AED ${(value / 1_000_000_000).toFixed(2)}B`
  if (value >= 1_000_000) return `AED ${(value / 1_000_000).toFixed(2)}M`
  return `AED ${value.toLocaleString('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function calcFields(item: any) {
  const amt = item.amount || 0
  const marginPct = item.commissionPercentage ?? null
  const bankPct = item.bankCharges ?? null
  const vatPct = item.vatPercentage ?? null
  const marginAmt = marginPct != null ? amt * marginPct / 100 : null
  const bankAmt = bankPct != null ? amt * bankPct / 100 : null
  const vatAmt = vatPct != null && bankAmt != null ? bankAmt * vatPct / 100 : null
  const netReceived = bankAmt != null && vatAmt != null ? amt - bankAmt - vatAmt : null
  const toPay = marginAmt != null && bankAmt != null && vatAmt != null ? marginAmt - bankAmt - vatAmt : null
  const balance = item.paid != null && toPay != null ? toPay - item.paid : null
  return { amt, marginPct, bankPct, vatPct, marginAmt, bankAmt, vatAmt, netReceived, toPay, balance }
}

const fmtAmt = (v: number | null) => v != null ? `AED ${v.toFixed(2)}` : '—'
const fmtPct = (v: number | null) => v != null ? `${v}%` : '—'

export default function Reports() {
  const { t } = useLanguage()
  const { user } = useCurrentUser()
  const isAdmin = user?.role === 'admin'
  const [loading, setLoading] = useState(true)
  const [reportType, setReportType] = useState('receipts')
  const [dateRange, setDateRange] = useState('month')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [reportData, setReportData] = useState<any>(null)
  const [showFilter, setShowFilter] = useState(false)
  const [filters, setFilters] = useState<Record<string, string>>({})
  const [agents, setAgents] = useState<{_id: string, name: string}[]>([])
  const [posMachines, setPosMachines] = useState<any[]>([])

  useEffect(() => { fetchReportData() }, [reportType, dateRange])

  useEffect(() => {
    fetch('/api/users?role=agent').then(r => r.ok ? r.json() : null).then(d => d && setAgents(d.users || []))
    fetch('/api/pos-machines').then(r => r.ok ? r.json() : null).then(d => d && setPosMachines(d.machines || []))
  }, [])

  const fetchReportData = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        type: reportType, range: dateRange,
        ...(startDate && { startDate }),
        ...(endDate && { endDate }),
      })
      const res = await fetch(`/api/reports?${params}`)
      if (res.ok) setReportData(await res.json())
    } catch {
      toast.error('Failed to load report data')
    } finally {
      setLoading(false)
    }
  }

  const exportReport = (exportFormat: 'excel' | 'pdf') => {
    if (!reportData) return
    if (exportFormat === 'excel') {
      const { exportToExcel, reportColumns } = require('@/lib/excelExport')
      const mappedData = reportData.items?.map((r: any) => {
        const { amt, marginPct, bankPct, vatPct, marginAmt, bankAmt, vatAmt, netReceived, toPay, balance } = calcFields(r)
        return {
          ...r,
          batchId: r.receiptNumber || r.transactionId || '',
          posMachineInfo: r.posMachineSegment && r.posMachineBrand ? `${r.posMachineSegment} / ${r.posMachineBrand}` : '',
          agent: r.agent || '',
          date: r.date ? format(new Date(r.date), 'dd-MMM-yyyy') : (r.createdAt ? format(new Date(r.createdAt), 'dd-MMM-yyyy') : ''),
          posReceiptAmount: `AED ${amt.toLocaleString()}`,
          marginPct: fmtPct(marginPct),
          marginAmt: fmtAmt(marginAmt),
          bankPct: fmtPct(bankPct),
          bankAmt: fmtAmt(bankAmt),
          vatPct: fmtPct(vatPct),
          vatAmt: fmtAmt(vatAmt),
          netReceived: fmtAmt(netReceived),
          toPay: fmtAmt(toPay),
          marginCol: fmtAmt(marginAmt),
          paid: r.paid != null ? `AED ${r.paid.toFixed(2)}` : '—',
          balance: fmtAmt(balance),
          createdBy: r.createdBy || '',
          updatedBy: r.updatedBy || '',
          description: r.description || '',
        }
      }) || []
      exportToExcel({
        filename: `${reportType}_report`,
        sheetName: reportType.charAt(0).toUpperCase() + reportType.slice(1),
        columns: isAdmin ? reportColumns.reportsAdmin(t) : reportColumns.reportsAgent(t),
        data: mappedData,
        title: `DSR Info — ${reportType.toUpperCase()} Report (${dateRange})`,
        isRTL: false,
      })
      toast.success('Report exported to Excel')
    } else {
      toast.success('PDF export functionality coming soon')
    }
  }

  const summaryCards = [
    { label: 'Total Revenue', value: formatAED(reportData?.totalRevenue || 0), icon: TrendingUp, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
    { label: 'Total Transactions', value: String(reportData?.totalTransactions || 0), icon: Calendar, color: 'text-primary', bg: 'bg-yellow-50 dark:bg-yellow-900/20' },
    { label: 'Average Transaction', value: formatAED(reportData?.averageTransaction || 0), icon: FileText, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-900/20' },
    { label: 'Commission Earned', value: formatAED(reportData?.totalCommission || 0), icon: Calculator, color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-50 dark:bg-purple-900/20' },
  ]

  const filteredItems = (reportData?.items || []).filter((item: any) => {
    const matchBatchId = !filters.batchId || (item.receiptNumber || item.transactionId || '').toLowerCase().includes(filters.batchId.toLowerCase())
    const matchAgent = !filters.agent || filters.agent === 'all' || item.agentId === filters.agent || item.agent === agents.find(a => a._id === filters.agent)?.name
    const matchPOS = !filters.posMachine || filters.posMachine === 'all' || item.posMachineId === filters.posMachine
    return matchBatchId && matchAgent && matchPOS
  })

  const activeFilterCount = Object.values(filters).filter(v => v && v !== 'all').length

  const filterFields = [
    { key: 'batchId', label: 'Batch ID', type: 'text' as const, placeholder: 'Filter by batch ID...' },
    { key: 'agent', label: 'Agent', type: 'select' as const, options: [{ value: 'all', label: 'All Agents' }, ...agents.map(a => ({ value: a._id, label: a.name }))] },
    { key: 'posMachine', label: 'POS Machine', type: 'select' as const, options: [{ value: 'all', label: 'All POS Machines' }, ...posMachines.map(m => ({ value: m._id, label: `${m.segment} / ${m.brand} — ${m.terminalId}` }))] },
  ]

  // Column definitions for the table
  const adminCols = [
    { key: 'batchId', label: 'Batch ID', cls: 'font-semibold text-gray-900 dark:text-white' },
    { key: 'posMachine', label: 'POS Machine', cls: '' },
    { key: 'agent', label: 'Agent', cls: '' },
    { key: 'date', label: 'Date', cls: '' },
    { key: 'posReceiptAmount', label: 'POS/Receipt Amount', cls: 'text-right font-semibold text-primary' },
    { key: 'marginPct', label: 'Margin %', cls: 'text-center' },
    { key: 'marginAmt', label: 'Margin Amount', cls: 'text-right' },
    { key: 'bankPct', label: 'Bank Charges %', cls: 'text-center' },
    { key: 'bankAmt', label: 'Bank Charges Amt', cls: 'text-right' },
    { key: 'vatPct', label: 'VAT %', cls: 'text-center' },
    { key: 'vatAmt', label: 'VAT Amount', cls: 'text-right' },
    { key: 'netReceived', label: 'Net Received', cls: 'text-right font-semibold text-emerald-600 dark:text-emerald-400' },
    { key: 'toPay', label: 'To Pay Amount', cls: 'text-right' },
    { key: 'margin', label: 'Margin', cls: 'text-right' },
    { key: 'paid', label: 'Paid', cls: 'text-right text-blue-600 dark:text-blue-400' },
    { key: 'balance', label: 'Balance', cls: 'text-right' },
    { key: 'createdBy', label: 'Created By', cls: '' },
    { key: 'updatedBy', label: 'Updated By', cls: '' },
    { key: 'description', label: 'Description', cls: 'max-w-[180px] truncate' },
  ]

  const agentCols = [
    { key: 'batchId', label: 'Batch ID', cls: 'font-semibold text-gray-900 dark:text-white' },
    { key: 'posMachine', label: 'POS Machine', cls: '' },
    { key: 'agent', label: 'Agent', cls: '' },
    { key: 'date', label: 'Date', cls: '' },
    { key: 'posReceiptAmount', label: 'POS/Receipt Amount', cls: 'text-right font-semibold text-primary' },
    { key: 'netReceived', label: 'Net Received', cls: 'text-right font-semibold text-emerald-600 dark:text-emerald-400' },
    { key: 'paid', label: 'Paid', cls: 'text-right text-blue-600 dark:text-blue-400' },
    { key: 'balance', label: 'Balance', cls: 'text-right' },
    { key: 'description', label: 'Description', cls: 'max-w-[180px] truncate' },
  ]

  const cols = isAdmin ? adminCols : agentCols

  const getCellValue = (item: any, key: string) => {
    const { amt, marginPct, bankPct, vatPct, marginAmt, bankAmt, vatAmt, netReceived, toPay, balance } = calcFields(item)
    switch (key) {
      case 'batchId': return item.receiptNumber || item.transactionId || '—'
      case 'posMachine': return item.posMachineSegment && item.posMachineBrand ? `${item.posMachineSegment} / ${item.posMachineBrand}` : '—'
      case 'agent': return item.agent || '—'
      case 'date': return item.date ? format(new Date(item.date), 'dd-MMM-yyyy') : (item.createdAt ? format(new Date(item.createdAt), 'dd-MMM-yyyy') : '—')
      case 'posReceiptAmount': return `AED ${amt.toLocaleString('en-AE', { minimumFractionDigits: 2 })}`
      case 'marginPct': return fmtPct(marginPct)
      case 'marginAmt': return fmtAmt(marginAmt)
      case 'bankPct': return fmtPct(bankPct)
      case 'bankAmt': return fmtAmt(bankAmt)
      case 'vatPct': return fmtPct(vatPct)
      case 'vatAmt': return fmtAmt(vatAmt)
      case 'netReceived': return fmtAmt(netReceived)
      case 'toPay': return fmtAmt(toPay)
      case 'margin': return fmtAmt(marginAmt)
      case 'paid': return item.paid != null ? `AED ${Number(item.paid).toFixed(2)}` : '—'
      case 'balance': return fmtAmt(balance)
      case 'createdBy': return item.createdBy || '—'
      case 'updatedBy': return item.updatedBy || '—'
      case 'description': return item.description || '—'
      default: return '—'
    }
  }

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">{t('reports')}</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t('viewReports')}</p>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <button onClick={() => exportReport('excel')} className="btn-secondary inline-flex items-center gap-2 text-sm">
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">{t('exportExcel')}</span>
            <span className="sm:hidden">Excel</span>
          </button>
          <button onClick={() => exportReport('pdf')} className="dubai-button inline-flex items-center gap-2 text-sm">
            <FileText className="h-4 w-4" />
            <span className="hidden sm:inline">{t('exportPDF')}</span>
            <span className="sm:hidden">PDF</span>
          </button>
          <FilterButton onClick={() => setShowFilter(true)} activeCount={activeFilterCount} />
        </div>
      </div>

      <FilterPanel
        open={showFilter}
        onClose={() => setShowFilter(false)}
        fields={filterFields}
        values={filters}
        onChange={(key, value) => setFilters(prev => ({ ...prev, [key]: value }))}
        onReset={() => setFilters({})}
        activeCount={activeFilterCount}
      />

      {/* Filters */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {isAdmin && (
          <select className="form-select col-span-2 md:col-span-1" value={reportType} onChange={(e) => setReportType(e.target.value)}>
            <option value="receipts">Receipts Report</option>
            <option value="transactions">All Transactions</option>
            <option value="payments">Payments Report</option>
            <option value="settlements">Settlements Report</option>
            <option value="agents">Agent Performance</option>
            <option value="commission">Commission Report</option>
            <option value="summary">Summary Report</option>
          </select>
        )}
        <select className="form-select" value={dateRange} onChange={(e) => setDateRange(e.target.value)}>
          <option value="today">Today</option>
          <option value="week">This Week</option>
          <option value="month">{t('monthlyReport')}</option>
          <option value="year">{t('yearlyReport')}</option>
          <option value="custom">Custom Range</option>
        </select>
        {dateRange === 'custom' && (
          <>
            <DatePicker placeholder="Start Date" value={startDate} onChange={setStartDate} />
            <DatePicker placeholder="End Date" value={endDate} onChange={setEndDate} />
          </>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {summaryCards.map((card) => {
          const Icon = card.icon
          return (
            <div key={card.label} className="dubai-card p-4 sm:p-5">
              <div className="flex items-start gap-3">
                <div className={`p-2.5 rounded-xl flex-shrink-0 ${card.bg}`}>
                  <Icon className={`h-5 w-5 ${card.color}`} />
                </div>
                <div className="flex-1 min-w-0 overflow-hidden">
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 truncate">{card.label}</p>
                  <p className="text-sm sm:text-base font-bold text-gray-900 dark:text-white break-words leading-snug">
                    {loading ? <span className="inline-block h-5 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" /> : card.value}
                  </p>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Data Table */}
      <div className="dubai-card overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">
            {reportType.charAt(0).toUpperCase() + reportType.slice(1)} Details
          </h3>
          {!loading && (
            <span className="text-xs text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-700 px-2.5 py-1 rounded-full font-medium">
              {filteredItems.length} record{filteredItems.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        {loading ? (
          <div className="p-5"><TableSkeleton rows={5} columns={cols.length} /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse">
              <thead>
                <tr className="bg-[#D4AF37]/10 dark:bg-[#D4AF37]/5 border-b-2 border-[#D4AF37]/30">
                  {cols.map((col, i) => (
                    <th
                      key={col.key}
                      className={`px-3 py-3 text-xs font-bold text-gray-700 dark:text-gray-200 uppercase tracking-wider whitespace-nowrap border-r border-[#D4AF37]/20 last:border-r-0 ${
                        col.cls.includes('text-right') ? 'text-right' : col.cls.includes('text-center') ? 'text-center' : 'text-left'
                      } ${i === 0 ? 'pl-5' : ''}`}
                    >
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60">
                {filteredItems.length > 0 ? filteredItems.map((item: any, rowIdx: number) => (
                  <tr
                    key={rowIdx}
                    className={`transition-colors hover:bg-[#D4AF37]/5 dark:hover:bg-[#D4AF37]/5 ${
                      rowIdx % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-gray-50/60 dark:bg-gray-800/60'
                    }`}
                  >
                    {cols.map((col, colIdx) => (
                      <td
                        key={col.key}
                        className={`px-3 py-2.5 text-sm whitespace-nowrap border-r border-gray-100 dark:border-gray-700/40 last:border-r-0 text-gray-600 dark:text-gray-300 ${col.cls} ${colIdx === 0 ? 'pl-5' : ''}`}
                        title={col.cls.includes('truncate') ? String(getCellValue(item, col.key)) : undefined}
                      >
                        {getCellValue(item, col.key)}
                      </td>
                    ))}
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={cols.length} className="px-5 py-16 text-center">
                      <FileText className="h-10 w-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                      <p className="text-sm font-medium text-gray-500 dark:text-gray-400">No data available for selected criteria</p>
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Try adjusting your filters or date range</p>
                    </td>
                  </tr>
                )}
              </tbody>
              {filteredItems.length > 0 && (
                <tfoot className="bg-[#D4AF37]/10 dark:bg-[#D4AF37]/5 border-t-2 border-[#D4AF37]/30">
                  <tr>
                    {cols.map((col, i) => {
                      const numericKeys = ['posReceiptAmount', 'marginAmt', 'bankAmt', 'vatAmt', 'netReceived', 'toPay', 'margin', 'paid', 'balance']
                      if (i === 0) return <td key={col.key} className="px-3 py-2.5 pl-5 text-xs font-bold text-gray-700 dark:text-gray-200 uppercase">Totals</td>
                      if (numericKeys.includes(col.key)) {
                        const total = filteredItems.reduce((sum: number, item: any) => {
                          const { amt, marginAmt, bankAmt, vatAmt, netReceived, toPay, balance } = calcFields(item)
                          const map: Record<string, number | null> = { posReceiptAmount: amt, marginAmt, bankAmt, vatAmt, netReceived, toPay, margin: marginAmt, paid: item.paid ?? null, balance }
                          return sum + (map[col.key] ?? 0)
                        }, 0)
                        return <td key={col.key} className="px-3 py-2.5 text-xs font-bold text-right text-gray-800 dark:text-gray-100 border-r border-[#D4AF37]/20 last:border-r-0">AED {total.toFixed(2)}</td>
                      }
                      return <td key={col.key} className="px-3 py-2.5 border-r border-[#D4AF37]/20 last:border-r-0" />
                    })}
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
