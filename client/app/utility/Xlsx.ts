/**
 * A minimal .xlsx writer: one sheet of text and numbers with a bold header row, built with JSZip so no
 * spreadsheet library is needed. An .xlsx file is a zip of a few SpreadsheetML documents.
 */

type Cell = string | number | undefined

function escapeXML(value: string) {
	return (
		value
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;')
			// characters XML 1.0 doesn't allow
			// eslint-disable-next-line no-control-regex
			.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '')
	)
}

/** e.g. 0 → A, 26 → AA */
function columnName(index: number) {
	let name = ''
	for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) {
		name = String.fromCharCode(65 + ((n - 1) % 26)) + name
	}
	return name
}

function cellXML(value: Cell, reference: string, isHeader: boolean) {
	const style = isHeader ? ' s="1"' : ''
	if (typeof value === 'number' && Number.isFinite(value)) {
		return `<c r="${reference}"${style}><v>${value}</v></c>`
	}
	const text = value === undefined ? '' : String(value)
	if (text === '') return ''
	return `<c r="${reference}" t="inlineStr"${style}><is><t xml:space="preserve">${escapeXML(
		text
	)}</t></is></c>`
}

function sheetXML(rows: Cell[][]) {
	const columnCount = Math.max(0, ...rows.map((row) => row.length))
	// wide enough for the longest line of each column, within limits
	const widths = Array.from({ length: columnCount }, (_, column) => {
		const longest = Math.max(
			...rows.map((row) =>
				Math.max(
					...String(row[column] ?? '')
						.split('\n')
						.map((line) => line.length)
				)
			)
		)
		return Math.min(60, Math.max(8, longest + 2))
	})
	const cols = widths
		.map(
			(width, index) =>
				`<col min="${index + 1}" max="${
					index + 1
				}" width="${width}" customWidth="1"/>`
		)
		.join('')
	const data = rows
		.map(
			(row, rowIndex) =>
				`<row r="${rowIndex + 1}">${row
					.map((value, column) =>
						cellXML(
							value,
							`${columnName(column)}${rowIndex + 1}`,
							rowIndex === 0
						)
					)
					.join('')}</row>`
		)
		.join('')
	return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>${
		cols ? `<cols>${cols}</cols>` : ''
	}<sheetData>${data}</sheetData></worksheet>`
}

/** A workbook with one sheet; the first row is the header, in bold and frozen. */
export async function buildXlsx(
	sheetName: string,
	rows: Cell[][]
): Promise<Blob> {
	const { default: JSZip } = await import('jszip')
	const zip = new JSZip()
	// sheet names can't be longer than 31 characters or contain some symbols
	const name = escapeXML(
		sheetName.replace(/[\\/?*[\]:]/g, ' ').slice(0, 31) || 'Sheet1'
	)

	zip.file(
		'[Content_Types].xml',
		`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`
	)
	zip.file(
		'_rels/.rels',
		`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`
	)
	zip.file(
		'xl/workbook.xml',
		`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${name}" sheetId="1" r:id="rId1"/></sheets></workbook>`
	)
	zip.file(
		'xl/_rels/workbook.xml.rels',
		`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`
	)
	// style 0 is normal and wraps text, style 1 is the bold header
	zip.file(
		'xl/styles.xml',
		`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`
	)
	zip.file('xl/worksheets/sheet1.xml', sheetXML(rows))

	return zip.generateAsync({
		type: 'blob',
		mimeType:
			'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
	})
}
