const CANDIDATE_DELIMITERS = [',', ';', '\t']

/**
 * Picks the delimiter that appears most often in the header row (outside of quotes).
 * Spreadsheet tools in many locales export CSV files separated by semicolons instead of commas.
 */
export function detectDelimiter(text: string): string {
	const counts = new Map<string, number>(
		CANDIDATE_DELIMITERS.map((delimiter) => [delimiter, 0])
	)
	let inQuotes = false
	for (const char of text) {
		if (char === '"') {
			inQuotes = !inQuotes
		} else if (!inQuotes && (char === '\n' || char === '\r')) {
			break
		} else if (!inQuotes && counts.has(char)) {
			counts.set(char, counts.get(char)! + 1)
		}
	}

	let bestDelimiter = ','
	let bestCount = 0
	for (const [delimiter, count] of counts) {
		if (count > bestCount) {
			bestDelimiter = delimiter
			bestCount = count
		}
	}
	return bestDelimiter
}

/**
 * Parses CSV text following RFC 4180: quoted fields may contain delimiters, line breaks
 * and escaped quotes (""). Completely empty lines are skipped.
 */
export function parseCSV(input: string, delimiter = detectDelimiter(input)) {
	const text = input.replace(/^\uFEFF/, '')
	const rows: string[][] = []
	let row: string[] = []
	let field = ''
	let inQuotes = false

	const endRow = () => {
		row.push(field)
		if (row.some((value) => value.trim() !== '')) {
			rows.push(row)
		}
		row = []
		field = ''
	}

	for (let i = 0; i < text.length; i++) {
		const char = text[i]

		if (inQuotes) {
			if (char === '"') {
				if (text[i + 1] === '"') {
					field += '"'
					i++
				} else {
					inQuotes = false
				}
			} else {
				field += char
			}
			continue
		}

		if (char === '"') {
			inQuotes = true
		} else if (char === delimiter) {
			row.push(field)
			field = ''
		} else if (char === '\n') {
			endRow()
		} else if (char === '\r') {
			if (text[i + 1] === '\n') i++
			endRow()
		} else {
			field += char
		}
	}

	if (field !== '' || row.length > 0) {
		endRow()
	}

	return rows
}

function escapeCSVField(value: string) {
	if (/[",\r\n]/.test(value)) {
		return `"${value.replace(/"/g, '""')}"`
	}
	return value
}

export function toCSV(rows: string[][]) {
	return rows.map((row) => row.map(escapeCSVField).join(',')).join('\r\n')
}
