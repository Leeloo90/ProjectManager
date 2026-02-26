import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer'
import { formatCurrency, formatDate, getBracketLabel } from '@/lib/utils'

const NAVY = '#1e3a5f'

const s = StyleSheet.create({
  page: { fontFamily: 'Helvetica', fontSize: 10, padding: 44, color: '#111827' },
  row: { flexDirection: 'row' },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 28 },
  bizName: { fontSize: 22, fontFamily: 'Helvetica-Bold', color: NAVY, marginBottom: 4 },
  muted: { fontSize: 9, color: '#6b7280' },
  right: { alignItems: 'flex-end' },
  invoiceTitle: { fontSize: 20, fontFamily: 'Helvetica-Bold', color: '#374151', marginBottom: 4 },
  invoiceNum: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#374151', marginBottom: 6 },
  billToBox: { backgroundColor: '#f9fafb', padding: 12, marginBottom: 24 },
  billToLabel: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#9ca3af', marginBottom: 6 },
  bold: { fontFamily: 'Helvetica-Bold' },
  tableHead: { flexDirection: 'row', borderBottomWidth: 1.5, borderBottomColor: '#e5e7eb', paddingBottom: 6, marginBottom: 4 },
  th: { fontFamily: 'Helvetica-Bold', color: '#374151' },
  projectRow: { flexDirection: 'row', borderTopWidth: 0.5, borderTopColor: '#e5e7eb', paddingTop: 8, paddingBottom: 4 },
  lineRow: { flexDirection: 'row', paddingVertical: 3, paddingLeft: 12 },
  lineDetail: { fontSize: 8, color: '#9ca3af', marginTop: 1 },
  subtotalRow: { flexDirection: 'row', borderTopWidth: 0.5, borderTopColor: '#e5e7eb', paddingTop: 3, paddingBottom: 8 },
  footerRow: { flexDirection: 'row', borderTopWidth: 1.5, borderTopColor: '#d1d5db', paddingTop: 8, paddingBottom: 4 },
  totalRow: { flexDirection: 'row', borderTopWidth: 2, borderTopColor: NAVY, paddingTop: 8, paddingBottom: 8 },
  totalText: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: NAVY },
  bankingSection: { borderTopWidth: 0.5, borderTopColor: '#e5e7eb', paddingTop: 12, marginTop: 20 },
  sectionLabel: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#9ca3af', marginBottom: 4 },
  termsBox: { backgroundColor: '#f9fafb', padding: 8, marginTop: 12 },
})

export function InvoicePDF({ invoice, linkedProjects, projectDetails, settings, logoUrl }: {
  invoice: any; linkedProjects: any[]; projectDetails: Record<string, { deliverables: any[]; shoot: any | null }>; settings: any; logoUrl?: string
}) {
  return (
    <Document>
      <Page size="A4" style={s.page}>

        {/* Header */}
        <View style={s.header}>
          <View>
            {logoUrl
              ? <Image src={logoUrl} style={{ height: 48, objectFit: 'contain', objectPositionX: 0, marginBottom: 4 }} />
              : <Text style={s.bizName}>{settings?.businessName ?? 'Ambient Arts'}</Text>
            }
            {settings?.businessRegistrationNumber && (
              <Text style={[s.muted, { marginTop: 2, fontStyle: 'italic' }]}>Reg: {settings.businessRegistrationNumber}</Text>
            )}
            {settings?.businessAddress && (
              <Text style={s.muted}>{settings.businessAddress}</Text>
            )}
            {settings?.vatNumber && (
              <Text style={[s.muted, { marginTop: 2 }]}>VAT: {settings.vatNumber}</Text>
            )}
          </View>
          <View style={s.right}>
            <Text style={s.invoiceTitle}>INVOICE</Text>
            <Text style={s.invoiceNum}>{invoice.invoiceNumber}</Text>
            <Text style={[s.muted, { marginBottom: 2 }]}>Date: {formatDate(invoice.invoiceDate)}</Text>
            <Text style={[s.muted, { marginBottom: 2 }]}>Due: {formatDate(invoice.dueDate)}</Text>
            {invoice.poReference && (
              <Text style={s.muted}>PO: {invoice.poReference}</Text>
            )}
          </View>
        </View>

        {/* Bill To */}
        <View style={s.billToBox}>
          <Text style={s.billToLabel}>BILL TO</Text>
          <Text style={[s.bold, { marginBottom: 2 }]}>{invoice.companyName}</Text>
          {invoice.billingAddress && (
            <Text style={[s.muted, { marginBottom: 2 }]}>{invoice.billingAddress}</Text>
          )}
          {invoice.vatNumber && (
            <Text style={[s.muted, { marginBottom: 2 }]}>VAT: {invoice.vatNumber}</Text>
          )}
          <Text style={s.muted}>Attn: {invoice.primaryContactName} · {invoice.primaryContactEmail}</Text>
        </View>

        {/* Line items */}
        <View>
          <View style={s.tableHead}>
            <Text style={[s.th, { flex: 1 }]}>Description</Text>
            <Text style={s.th}>Amount</Text>
          </View>

          {(() => {
            const overrides: Record<string, number> = invoice.lineItemOverrides
              ? JSON.parse(invoice.lineItemOverrides)
              : {}
            return linkedProjects.map((p) => {
              const details = projectDetails[p.id]
              const deliverableTotal = details.deliverables.reduce((sum: number, d) => sum + d.calculatedCost, 0)
              const shootCost = details.shoot?.calculatedShootCost ?? 0
              const isOverridden = overrides[p.id] !== undefined
              const projectTotal = isOverridden ? overrides[p.id] : deliverableTotal + shootCost
              return (
                <View key={p.id}>
                  <View style={s.projectRow}>
                    <Text style={[s.bold, { flex: 1 }]}>
                      {p.name}{p.clientName ? `  —  ${p.clientName}` : ''}
                    </Text>
                  </View>

                  {details.deliverables.map((d) => (
                    <View key={d.id} style={s.lineRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: '#374151' }}>{d.name}</Text>
                        <Text style={s.lineDetail}>
                          {[
                            getBracketLabel(d.durationBracket),
                            d.primaryFormat,
                            d.editType === 'colour_only' ? 'Colour Only' : d.editType === 'basic' ? 'Basic Edit' : 'Advanced Edit',
                            d.colourGrading && d.colourGrading !== 'none' ? (d.colourGrading === 'standard' ? 'Standard Grade' : 'Advanced Grade') : null,
                            d.subtitles && d.subtitles !== 'none' ? (d.subtitles === 'basic' ? 'Basic Subtitles' : 'Styled Subtitles') : null,
                            d.additionalFormats ? `${d.additionalFormats} extra format(s)` : null,
                            d.rushFeeType && d.rushFeeType !== 'none' ? (d.rushFeeType === 'standard' ? 'Rush: Standard' : 'Rush: Emergency') : null,
                            d.hasCustomMusic ? 'Custom Music' : null,
                            d.hasCustomGraphics ? 'Custom Graphics' : null,
                          ].filter(Boolean).join(' · ')}
                        </Text>
                      </View>
                      {!isOverridden && <Text style={{ color: '#374151' }}>{formatCurrency(d.calculatedCost)}</Text>}
                    </View>
                  ))}

                  {details.shoot && (
                    <View style={s.lineRow}>
                      <Text style={{ flex: 1, color: '#374151' }}>
                        Shoot ({details.shoot.shootType === 'half_day' ? 'Half Day' : 'Full Day'} · {details.shoot.cameraBody === 'a7siii' ? 'Sony a7SIII' : 'Sony a7III'})
                      </Text>
                      {!isOverridden && <Text style={{ color: '#374151' }}>{formatCurrency(details.shoot.calculatedShootCost)}</Text>}
                    </View>
                  )}

                  <View style={s.subtotalRow}>
                    <Text style={[s.muted, { flex: 1, paddingLeft: 12 }]}>Project Subtotal</Text>
                    <Text style={[s.bold, { color: '#374151' }]}>{formatCurrency(projectTotal)}</Text>
                  </View>
                </View>
              )
            })
          })()}

          <View style={s.footerRow}>
            <Text style={[s.bold, { flex: 1, color: '#374151' }]}>Subtotal</Text>
            <Text style={[s.bold, { color: '#374151' }]}>{formatCurrency(invoice.subtotal)}</Text>
          </View>

          {invoice.discountType && invoice.discountType !== 'none' && invoice.discountValue > 0 && (() => {
            const amt = invoice.discountType === 'percentage'
              ? Math.round(invoice.subtotal * invoice.discountValue / 100 * 100) / 100
              : invoice.discountValue
            return (
              <View style={{ flexDirection: 'row', paddingVertical: 4 }}>
                <Text style={[s.muted, { flex: 1 }]}>
                  Discount {invoice.discountType === 'percentage' ? `(${invoice.discountValue}%)` : '(fixed)'}
                </Text>
                <Text style={[s.muted, { color: '#15803d' }]}>-{formatCurrency(amt)}</Text>
              </View>
            )
          })()}

          {invoice.vatAmount > 0 && (
            <View style={{ flexDirection: 'row', paddingVertical: 4 }}>
              <Text style={[s.muted, { flex: 1 }]}>VAT ({settings?.vatRate ?? 15}%)</Text>
              <Text style={s.muted}>{formatCurrency(invoice.vatAmount)}</Text>
            </View>
          )}

          <View style={s.totalRow}>
            <Text style={[s.totalText, { flex: 1 }]}>TOTAL DUE</Text>
            <Text style={s.totalText}>{formatCurrency(invoice.total)}</Text>
          </View>
        </View>

        {/* Banking details */}
        {settings?.bankingDetails && (
          <View style={s.bankingSection}>
            <Text style={s.sectionLabel}>BANKING DETAILS</Text>
            <Text style={{ fontSize: 9, color: '#374151' }}>{settings.bankingDetails}</Text>
          </View>
        )}

        {/* Payment terms */}
        {settings?.paymentTermsText && (
          <View style={s.termsBox}>
            <Text style={{ fontSize: 8, color: '#9ca3af' }}>{settings.paymentTermsText}</Text>
          </View>
        )}

      </Page>
    </Document>
  )
}
