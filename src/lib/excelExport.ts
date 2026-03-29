import * as XLSX from 'xlsx-js-style'

interface ExcelColumn {
  key: string
  label: string
  width?: number
}

interface ExcelExportOptions {
  filename: string
  sheetName: string
  columns: ExcelColumn[]
  data: any[]
  title?: string
  isRTL?: boolean
}

// DSR Info brand gold color
const BRAND_GOLD = 'D4AF37'
const BRAND_GOLD_LIGHT = 'FDF6DC'
const BRAND_GOLD_MID = 'F5E49C'
const WHITE = 'FFFFFF'
const DARK_TEXT = '1A1A2E'
const GRAY_BORDER = 'E5E7EB'
const ALT_ROW = 'FAFAF7'

export const exportToExcel = ({
  filename,
  sheetName,
  columns,
  data,
  title,
  isRTL = false
}: ExcelExportOptions) => {
  const workbook = XLSX.utils.book_new()

  const headers = columns.map(col => col.label)
  const rows = data.map(item => columns.map(col => item[col.key] ?? ''))

  const wsData = [
    ...(title ? [[title], []] : []),
    headers,
    ...rows
  ]

  const worksheet = XLSX.utils.aoa_to_sheet(wsData)

  // Column widths
  worksheet['!cols'] = columns.map(col => ({ wch: col.width || 20 }))

  // Row heights
  const rowHeights: any[] = []
  if (title) {
    rowHeights[0] = { hpt: 40 }
    rowHeights[1] = { hpt: 8 }
    rowHeights[2] = { hpt: 28 }
  } else {
    rowHeights[0] = { hpt: 28 }
  }
  for (let r = 0; r < data.length; r++) rowHeights.push({ hpt: 22 })
  worksheet['!rows'] = rowHeights

  // Title row — gold background
  if (title) {
    const titleCell = worksheet['A1']
    if (titleCell) {
      titleCell.s = {
        font: { bold: true, sz: 15, color: { rgb: DARK_TEXT } },
        fill: { fgColor: { rgb: BRAND_GOLD } },
        alignment: { horizontal: 'center', vertical: 'center' },
        border: {
          bottom: { style: 'medium', color: { rgb: BRAND_GOLD } },
        }
      }
    }
    worksheet['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: columns.length - 1 } }]
  }

  // Header row — gold background, dark text
  const headerRowIndex = title ? 2 : 0
  columns.forEach((_, colIndex) => {
    const cellAddress = XLSX.utils.encode_cell({ r: headerRowIndex, c: colIndex })
    if (!worksheet[cellAddress]) worksheet[cellAddress] = { v: headers[colIndex] }
    worksheet[cellAddress].s = {
      font: { bold: true, sz: 10, color: { rgb: DARK_TEXT } },
      fill: { fgColor: { rgb: BRAND_GOLD } },
      border: {
        top: { style: 'medium', color: { rgb: BRAND_GOLD } },
        bottom: { style: 'medium', color: { rgb: BRAND_GOLD } },
        left: { style: 'thin', color: { rgb: BRAND_GOLD_MID } },
        right: { style: 'thin', color: { rgb: BRAND_GOLD_MID } },
      },
      alignment: { horizontal: 'center', vertical: 'center', wrapText: true }
    }
  })

  // Data rows
  const dataStartRow = title ? 3 : 1
  for (let row = dataStartRow; row < dataStartRow + data.length; row++) {
    const isAlt = (row - dataStartRow) % 2 === 1
    columns.forEach((_, colIndex) => {
      const cellAddress = XLSX.utils.encode_cell({ r: row, c: colIndex })
      if (!worksheet[cellAddress]) worksheet[cellAddress] = { v: '' }
      worksheet[cellAddress].s = {
        fill: { fgColor: { rgb: isAlt ? ALT_ROW : WHITE } },
        border: {
          top: { style: 'thin', color: { rgb: GRAY_BORDER } },
          bottom: { style: 'thin', color: { rgb: GRAY_BORDER } },
          left: { style: 'thin', color: { rgb: GRAY_BORDER } },
          right: { style: 'thin', color: { rgb: GRAY_BORDER } },
        },
        alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
        font: { sz: 10 }
      }
    })
  }

  if (isRTL) worksheet['!dir'] = 'rtl'

  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName)

  const timestamp = new Date().toISOString().slice(0, 10)
  XLSX.writeFile(workbook, `${filename}_${timestamp}.xlsx`)
}

// Column configurations
export const reportColumns = {
  payments: (t: (key: string) => string) => [
    { key: 'paymentNumber', label: 'Batch ID', width: 22 },
    { key: 'date', label: t('date'), width: 18 },
    { key: 'agentName', label: t('agent'), width: 25 },
    { key: 'paymentMethod', label: t('paymentMethod'), width: 18 },
    { key: 'amount', label: t('amount'), width: 20 },
    { key: 'description', label: t('description'), width: 40 }
  ],

  transactions: (t: (key: string) => string) => [
    { key: 'transactionId', label: 'Batch ID', width: 25 },
    { key: 'date', label: t('date'), width: 18 },
    { key: 'clientName', label: 'Client', width: 25 },
    { key: 'amount', label: t('amount'), width: 20 },
    { key: 'commission', label: 'Commission', width: 20 },
    { key: 'status', label: t('status'), width: 15 }
  ],

  receiptsAgent: (t: (key: string) => string) => [
    { key: 'receiptNumber', label: 'Receipt No.', width: 22 },
    { key: 'date', label: t('date'), width: 18 },
    { key: 'posMachineInfo', label: 'POS Machine', width: 28 },
    { key: 'amount', label: t('amount'), width: 20 },
    { key: 'description', label: t('description'), width: 40 }
  ],

  receiptsAdmin: (t: (key: string) => string) => [
    { key: 'batchId', label: 'Batch ID', width: 22 },
    { key: 'posMachineInfo', label: 'POS Machine', width: 28 },
    { key: 'agent', label: 'Agent', width: 25 },
    { key: 'date', label: 'Date', width: 18 },
    { key: 'posReceiptAmount', label: 'POS/Receipt Amount', width: 22 },
    { key: 'marginPct', label: 'Margin %', width: 14 },
    { key: 'marginAmt', label: 'Margin Amount', width: 20 },
    { key: 'bankPct', label: 'Bank Charges %', width: 16 },
    { key: 'bankAmt', label: 'Bank Charges Amt', width: 20 },
    { key: 'vatPct', label: 'VAT %', width: 12 },
    { key: 'vatAmt', label: 'VAT Amount', width: 18 },
    { key: 'netReceived', label: 'Net Received', width: 20 },
    { key: 'toPay', label: 'To Pay Amount', width: 20 },
    { key: 'marginCol', label: 'Margin', width: 18 },
    { key: 'paid', label: 'Paid', width: 18 },
    { key: 'balance', label: 'Balance', width: 18 },
    { key: 'createdBy', label: 'Created By', width: 22 },
    { key: 'updatedBy', label: 'Updated By', width: 22 },
    { key: 'description', label: 'Description', width: 40 }
  ],

  reportsAgent: (t: (key: string) => string) => [
    { key: 'batchId', label: 'Batch ID', width: 22 },
    { key: 'posMachineInfo', label: 'POS Machine', width: 28 },
    { key: 'agent', label: 'Agent', width: 25 },
    { key: 'date', label: 'Date', width: 18 },
    { key: 'posReceiptAmount', label: 'POS/Receipt Amount', width: 22 },
    { key: 'netReceived', label: 'Net Received', width: 20 },
    { key: 'paid', label: 'Paid', width: 18 },
    { key: 'balance', label: 'Balance', width: 18 },
    { key: 'description', label: 'Description', width: 40 }
  ],

  reportsAdmin: (t: (key: string) => string) => [
    { key: 'batchId', label: 'Batch ID', width: 22 },
    { key: 'posMachineInfo', label: 'POS Machine', width: 28 },
    { key: 'agent', label: 'Agent', width: 25 },
    { key: 'date', label: 'Date', width: 18 },
    { key: 'posReceiptAmount', label: 'POS/Receipt Amount', width: 22 },
    { key: 'marginPct', label: 'Margin %', width: 14 },
    { key: 'marginAmt', label: 'Margin Amount', width: 20 },
    { key: 'bankPct', label: 'Bank Charges %', width: 16 },
    { key: 'bankAmt', label: 'Bank Charges Amt', width: 20 },
    { key: 'vatPct', label: 'VAT %', width: 12 },
    { key: 'vatAmt', label: 'VAT Amount', width: 18 },
    { key: 'netReceived', label: 'Net Received', width: 20 },
    { key: 'toPay', label: 'To Pay Amount', width: 20 },
    { key: 'marginCol', label: 'Margin', width: 18 },
    { key: 'paid', label: 'Paid', width: 18 },
    { key: 'balance', label: 'Balance', width: 18 },
    { key: 'createdBy', label: 'Created By', width: 22 },
    { key: 'updatedBy', label: 'Updated By', width: 22 },
    { key: 'description', label: 'Description', width: 40 }
  ]
}
