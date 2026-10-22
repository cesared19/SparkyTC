import { Project } from '~/models/project'
import {
	JiraIssue,
	TestCaseAttachment,
	TestCaseRun,
	TestCaseRunStatus,
	TestRun,
	TestRunStatus,
	TestRunTime,
} from '~/models/types'
import { formatDuration } from '~/components/TimeTracking'
import { Route } from '~/utility/Routes'
import { Tools } from '~/utility/Tools'

/**
 * The downloadable report of a test run, generated in the browser: a .zip with a visual summary as a .png
 * and a .pdf with each executed test case, its result, comments and images.
 */

export interface TestRunReportInput {
	project: Project
	testRun: TestRun
	testCaseRuns: TestCaseRun[]
	time: TestRunTime
}

interface ReportData extends TestRunReportInput {
	jiraIssues: JiraIssue[]
	generatedAt: Date
	counts: Record<
		'passed' | 'failed' | 'blocked' | 'skipped' | 'pending',
		number
	>
	executed: number
	total: number
	passRate?: number
	days: DayResults[]
}

interface DayResults {
	day: Date
	passed: number
	failed: number
	blocked: number
	skipped: number
}

// the chart palette of the app in light mode, validated for color vision deficiencies
const COLORS = {
	pass: '#15803d',
	fail: '#f87171',
	skip: '#0891b2',
	blocked: '#7c3aed',
	pending: '#d1d5db',
	page: '#f1f5f9',
	surface: '#ffffff',
	border: '#e5e7eb',
	grid: '#e5e7eb',
	text: '#111827',
	secondary: '#4b5563',
	muted: '#6b7280',
	brand: '#c01c37',
	// tile backgrounds, dark enough for white text
	passTile: '#15803d',
	failTile: '#b91c1c',
	progressTile: '#1d4ed8',
}

const STATUS_LABELS: Record<TestCaseRunStatus, string> = {
	[TestCaseRunStatus.pending]: 'Pending',
	[TestCaseRunStatus.pass]: 'Pass',
	[TestCaseRunStatus.fail]: 'Fail',
	[TestCaseRunStatus.skip]: 'Skip',
	[TestCaseRunStatus.blocked]: 'Blocked',
}

const RUN_STATUS_LABELS: Record<string, string> = {
	[TestRunStatus.pending]: 'Not started',
	[TestRunStatus.inProgress]: 'In progress',
	[TestRunStatus.complete]: 'Complete',
	[TestRunStatus.abort]: 'Aborted',
}

function formatDate(date: Date | number, withTime = false) {
	return new Date(date).toLocaleString('en-US', {
		month: 'short',
		day: 'numeric',
		year: 'numeric',
		...(withTime ? { hour: 'numeric', minute: '2-digit' } : {}),
	})
}

function formatRate(rate?: number) {
	return rate === undefined ? '–' : `${Math.round(rate * 100)}%`
}

function localDay(date: number) {
	const day = new Date(date)
	return new Date(day.getFullYear(), day.getMonth(), day.getDate())
}

function reportData(
	input: TestRunReportInput,
	jiraIssues: JiraIssue[]
): ReportData {
	const runs = input.testCaseRuns
	const count = (status: TestCaseRunStatus) =>
		runs.filter((run) => run.status === status).length
	const counts = {
		passed: count(TestCaseRunStatus.pass),
		failed: count(TestCaseRunStatus.fail),
		blocked: count(TestCaseRunStatus.blocked),
		skipped: count(TestCaseRunStatus.skip),
		pending: count(TestCaseRunStatus.pending),
	}
	const executed =
		counts.passed + counts.failed + counts.blocked + counts.skipped

	// each test case counts on the day its current result was recorded
	const days = new Map<number, DayResults>()
	for (const run of runs) {
		if (run.status === TestCaseRunStatus.pending) continue
		const day = localDay(run.executedAt ?? run.creationDate)
		const results = days.get(day.getTime()) ?? {
			day,
			passed: 0,
			failed: 0,
			blocked: 0,
			skipped: 0,
		}
		if (run.status === TestCaseRunStatus.pass) results.passed++
		if (run.status === TestCaseRunStatus.fail) results.failed++
		if (run.status === TestCaseRunStatus.blocked) results.blocked++
		if (run.status === TestCaseRunStatus.skip) results.skipped++
		days.set(day.getTime(), results)
	}

	return {
		...input,
		jiraIssues,
		generatedAt: new Date(),
		counts,
		executed,
		total: runs.length,
		passRate: executed > 0 ? counts.passed / executed : undefined,
		days: [...days.values()].sort((a, b) => a.day.getTime() - b.day.getTime()),
	}
}

function linkedIssueKeys(testCaseRuns: TestCaseRun[]) {
	return [
		...new Set(
			testCaseRuns.flatMap((run) =>
				(run.testCase.jiraLinks ?? []).map((link) => link.issueKey)
			)
		),
	]
}

async function loadJiraIssues(keys: string[]): Promise<JiraIssue[]> {
	if (keys.length === 0) return []
	try {
		const response = await fetch(Route.jiraIssues(keys))
		const data = await response.json()
		return Array.isArray(data?.issues) ? data.issues : []
	} catch {
		// the report still lists the keys without their status
		return []
	}
}

// ---------------------------------------------------------------------------------------------------------------
// summary image

const WIDTH = 800
const SCALE = 2
const PAD = 28
const GAP = 14

// heroicons outline paths, drawn with a 1.5 stroke on a 24 unit grid
const ICONS = {
	check: 'M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
	cross:
		'm9.75 9.75 4.5 4.5m0-4.5-4.5 4.5M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
	flag: 'M3 3v1.5M3 21v-6m0 0 2.77-.693a9 9 0 0 1 6.208.682l.108.054a9 9 0 0 0 6.086.71l3.114-.732a48.524 48.524 0 0 1-.005-10.499l-3.11.732a9 9 0 0 1-6.085-.711l-.108-.054a9 9 0 0 0-6.208-.682L3 4.5M3 15V4.5',
	squares:
		'M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25A2.25 2.25 0 0 1 13.5 18v-2.25Z',
	chart:
		'M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z',
	clock: 'M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
	bug: 'M12 12.75c1.148 0 2.278.08 3.383.237 1.037.146 1.866.966 1.866 2.013 0 3.728-2.35 6.75-5.25 6.75S6.75 18.728 6.75 15c0-1.046.83-1.867 1.866-2.013A24.204 24.204 0 0 1 12 12.75Zm0 0c2.883 0 5.647.508 8.207 1.44a23.91 23.91 0 0 1-1.152 6.06M12 12.75c-2.883 0-5.647.508-8.208 1.44.125 2.104.52 4.136 1.153 6.06M12 12.75a2.25 2.25 0 0 0 2.248-2.354M12 12.75a2.25 2.25 0 0 1-2.248-2.354M12 8.25c.995 0 1.971-.08 2.922-.236.403-.066.74-.358.795-.762a3.778 3.778 0 0 0-.399-2.25M12 8.25c-.995 0-1.97-.08-2.922-.236-.402-.066-.74-.358-.795-.762a3.734 3.734 0 0 1 .4-2.253M12 8.25a2.25 2.25 0 0 0-2.248 2.146M12 8.25a2.25 2.25 0 0 1 2.248 2.146M8.683 5a6.032 6.032 0 0 1-1.155-1.002c.07-.63.27-1.222.574-1.747m.581 2.749A3.75 3.75 0 0 1 15.318 5m0 0c.427-.283.815-.62 1.155-.999a4.471 4.471 0 0 0-.575-1.752M4.921 6a24.048 24.048 0 0 0-.392 3.314c1.668.546 3.416.914 5.223 1.082M19.08 6c.205 1.08.337 2.187.392 3.314a23.882 23.882 0 0 1-5.223 1.082',
}

class Painter {
	readonly ctx: CanvasRenderingContext2D
	readonly fontFamily: string

	constructor(ctx: CanvasRenderingContext2D, fontFamily: string) {
		this.ctx = ctx
		this.fontFamily = fontFamily
	}

	font(size: number, weight = 400) {
		this.ctx.font = `${weight} ${size}px ${this.fontFamily}`
	}

	text(
		value: string,
		x: number,
		y: number,
		options: {
			size: number
			weight?: number
			color: string
			align?: CanvasTextAlign
			maxWidth?: number
		}
	) {
		this.font(options.size, options.weight)
		this.ctx.fillStyle = options.color
		this.ctx.textAlign = options.align ?? 'left'
		this.ctx.textBaseline = 'alphabetic'
		const shown =
			options.maxWidth === undefined
				? value
				: this.truncate(value, options.maxWidth)
		this.ctx.fillText(shown, x, y)
		return this.ctx.measureText(shown).width
	}

	truncate(value: string, maxWidth: number) {
		if (this.ctx.measureText(value).width <= maxWidth) return value
		let end = value.length
		while (
			end > 0 &&
			this.ctx.measureText(`${value.slice(0, end)}…`).width > maxWidth
		) {
			end--
		}
		return `${value.slice(0, end)}…`
	}

	measure(value: string, size: number, weight = 400) {
		this.font(size, weight)
		return this.ctx.measureText(value).width
	}

	rect(
		x: number,
		y: number,
		width: number,
		height: number,
		radius: number | number[],
		fill: string,
		stroke?: string
	) {
		this.ctx.beginPath()
		this.ctx.roundRect(x, y, width, height, radius)
		this.ctx.fillStyle = fill
		this.ctx.fill()
		if (stroke) {
			this.ctx.strokeStyle = stroke
			this.ctx.lineWidth = 1
			this.ctx.stroke()
		}
	}

	icon(path: string, x: number, y: number, size: number, color: string) {
		this.ctx.save()
		this.ctx.translate(x, y)
		this.ctx.scale(size / 24, size / 24)
		this.ctx.strokeStyle = color
		this.ctx.lineWidth = 1.5
		this.ctx.lineCap = 'round'
		this.ctx.lineJoin = 'round'
		this.ctx.stroke(new Path2D(path))
		this.ctx.restore()
	}

	card(x: number, y: number, width: number, height: number) {
		this.rect(x, y, width, height, 14, COLORS.surface, COLORS.border)
	}

	cardTitle(icon: string, title: string, x: number, y: number) {
		this.icon(icon, x, y - 17, 22, COLORS.text)
		this.text(title, x + 32, y, { size: 18, weight: 700, color: COLORS.text })
	}
}

function bigTile(
	painter: Painter,
	box: { x: number; y: number; width: number; height: number },
	options: {
		color: string
		icon: string
		value: string
		label: string
		detail: string
		badge?: string
	}
) {
	const { x, y, width, height } = box
	painter.rect(x, y, width, height, 14, options.color)
	painter.icon(options.icon, x + 18, y + 16, 28, '#ffffff')
	if (options.badge) {
		const badgeWidth = painter.measure(options.badge, 12, 600) + 20
		painter.rect(
			x + width - 16 - badgeWidth,
			y + 18,
			badgeWidth,
			24,
			12,
			'rgba(255, 255, 255, 0.2)'
		)
		painter.text(options.badge, x + width - 26, y + 34, {
			size: 12,
			weight: 600,
			color: '#ffffff',
			align: 'right',
		})
	}
	painter.text(options.value, x + 18, y + 104, {
		size: 52,
		weight: 800,
		color: '#ffffff',
		maxWidth: width - 36,
	})
	painter.text(options.label, x + 18, y + 128, {
		size: 17,
		weight: 700,
		color: '#ffffff',
	})
	painter.text(options.detail, x + 18, y + 148, {
		size: 12,
		color: 'rgba(255, 255, 255, 0.9)',
		maxWidth: width - 36,
	})
}

const STATUS_SEGMENTS = [
	{
		key: 'passed' as const,
		label: 'Passed',
		color: COLORS.pass,
		ink: '#ffffff',
	},
	{
		key: 'failed' as const,
		label: 'Failed',
		color: COLORS.fail,
		ink: COLORS.text,
	},
	{
		key: 'blocked' as const,
		label: 'Blocked',
		color: COLORS.blocked,
		ink: '#ffffff',
	},
	{
		key: 'skipped' as const,
		label: 'Skipped',
		color: COLORS.skip,
		// white on cyan is below 4.5:1
		ink: COLORS.text,
	},
	{
		key: 'pending' as const,
		label: 'Pending',
		color: COLORS.pending,
		ink: COLORS.text,
	},
]

function statusCard(painter: Painter, data: ReportData, y: number) {
	const width = WIDTH - PAD * 2
	const height = 196
	painter.card(PAD, y, width, height)
	painter.cardTitle(ICONS.squares, 'Results by status', PAD + 20, y + 38)

	// one bar split by status, with a gap between segments
	const barX = PAD + 20
	const barWidth = width - 40
	const segments = STATUS_SEGMENTS.filter(
		(segment) => data.counts[segment.key] > 0
	)
	const gaps = (segments.length - 1) * 2
	let x = barX
	segments.forEach((segment, index) => {
		const segmentWidth =
			((barWidth - gaps) * data.counts[segment.key]) / Math.max(1, data.total)
		const isFirst = index === 0
		const isLast = index === segments.length - 1
		painter.rect(
			x,
			y + 56,
			segmentWidth,
			16,
			[isFirst ? 8 : 0, isLast ? 8 : 0, isLast ? 8 : 0, isFirst ? 8 : 0],
			segment.color
		)
		x += segmentWidth + 2
	})

	// a tile per status, so each color also has its number and name
	const tileWidth =
		(barWidth - GAP * (STATUS_SEGMENTS.length - 1)) / STATUS_SEGMENTS.length
	STATUS_SEGMENTS.forEach((segment, index) => {
		const tileX = barX + index * (tileWidth + GAP)
		const tileY = y + 88
		const value = data.counts[segment.key]
		painter.rect(tileX, tileY, tileWidth, 88, 12, segment.color)
		painter.text(String(value), tileX + 14, tileY + 46, {
			size: 34,
			weight: 800,
			color: segment.ink,
		})
		painter.text(
			data.total > 0 ? `${Math.round((value / data.total) * 100)}%` : '–',
			tileX + tileWidth - 14,
			tileY + 46,
			{ size: 15, weight: 700, color: segment.ink, align: 'right' }
		)
		painter.text(segment.label, tileX + 14, tileY + 74, {
			size: 15,
			weight: 700,
			color: segment.ink,
		})
	})
	return height
}

function niceMax(value: number) {
	if (value <= 4) return 4
	const step = Math.pow(10, Math.floor(Math.log10(value)))
	for (const multiple of [1, 2, 2.5, 5, 10]) {
		if (multiple * step >= value) return multiple * step
	}
	return value
}

function progressCard(
	painter: Painter,
	data: ReportData,
	box: { x: number; y: number; width: number; height: number }
) {
	const { x, y, width, height } = box
	const ctx = painter.ctx
	painter.card(x, y, width, height)
	painter.cardTitle(ICONS.chart, 'Progress by day', x + 20, y + 38)

	// legend
	let legendX = x + 20
	for (const segment of STATUS_SEGMENTS.filter(
		(segment) => segment.key !== 'pending'
	)) {
		painter.rect(legendX, y + 56, 10, 10, 2, segment.color)
		legendX +=
			16 +
			painter.text(segment.label, legendX + 16, y + 65, {
				size: 12,
				color: COLORS.secondary,
			}) +
			14
	}

	if (data.days.length === 0) {
		painter.text(
			'No results recorded yet',
			x + width / 2,
			y + height / 2 + 20,
			{
				size: 14,
				color: COLORS.muted,
				align: 'center',
			}
		)
		return
	}

	const plot = {
		left: x + 52,
		right: x + width - 20,
		top: y + 96,
		bottom: y + height - 40,
	}
	const max = niceMax(
		Math.max(
			...data.days.map(
				(day) => day.passed + day.failed + day.blocked + day.skipped
			)
		)
	)
	const yOf = (value: number) =>
		plot.bottom - (value / max) * (plot.bottom - plot.top)

	// recessive grid with the count on the left
	for (const step of [0, 0.5, 1]) {
		const value = Math.round(max * step)
		ctx.beginPath()
		ctx.moveTo(plot.left, yOf(value))
		ctx.lineTo(plot.right, yOf(value))
		ctx.strokeStyle = COLORS.grid
		ctx.lineWidth = 1
		ctx.stroke()
		painter.text(String(value), plot.left - 8, yOf(value) + 4, {
			size: 11,
			color: COLORS.muted,
			align: 'right',
		})
	}

	const band = (plot.right - plot.left) / data.days.length
	const barWidth = Math.min(28, band * 0.6)
	const labelEvery = Math.max(1, Math.ceil(56 / band))
	data.days.forEach((day, index) => {
		const center = plot.left + band * (index + 0.5)
		const barX = center - barWidth / 2
		const parts = [
			{ value: day.passed, color: COLORS.pass },
			{ value: day.failed, color: COLORS.fail },
			{ value: day.blocked, color: COLORS.blocked },
			{ value: day.skipped, color: COLORS.skip },
		].filter((part) => part.value > 0)
		let below = 0
		parts.forEach((part, partIndex) => {
			const isTop = partIndex === parts.length - 1
			const bottom = yOf(below)
			below += part.value
			const top = yOf(below)
			const segmentTop = isTop ? top : top + 2
			const segmentHeight = Math.max(0, bottom - segmentTop)
			painter.rect(
				barX,
				segmentTop,
				barWidth,
				segmentHeight,
				isTop ? [4, 4, 0, 0] : 0,
				part.color
			)
		})
		const total = day.passed + day.failed + day.blocked + day.skipped
		if (data.days.length <= 14) {
			painter.text(String(total), center, yOf(total) - 6, {
				size: 11,
				weight: 600,
				color: COLORS.secondary,
				align: 'center',
			})
		}
		if (index % labelEvery === 0 || index === data.days.length - 1) {
			painter.text(
				day.day.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
				center,
				plot.bottom + 20,
				{ size: 11, color: COLORS.muted, align: 'center' }
			)
		}
	})
}

const ISSUE_PILLS: Record<string, { fill: string; ink: string }> = {
	new: { fill: '#f3f4f6', ink: '#374151' },
	indeterminate: { fill: '#dbeafe', ink: '#1e40af' },
	done: { fill: '#dcfce7', ink: '#166534' },
}

function timeAndBugsCard(
	painter: Painter,
	data: ReportData,
	box: { x: number; y: number; width: number; height: number }
) {
	const { x, y, width, height } = box
	painter.card(x, y, width, height)
	painter.cardTitle(ICONS.clock, 'Time spent', x + 20, y + 38)

	if (data.time.trackTime) {
		painter.text(formatDuration(data.time.totalSeconds), x + 20, y + 84, {
			size: 32,
			weight: 800,
			color: COLORS.text,
		})
		const perTestCase =
			data.executed > 0 ? data.time.totalSeconds / data.executed : 0
		const average =
			perTestCase > 0 && data.time.overrideSeconds == null
				? ` · ${formatDuration(perTestCase)} per executed test case`
				: ''
		painter.text(
			data.time.overrideSeconds != null
				? 'Total set by an admin'
				: `Tracked while testing${average}`,
			x + 20,
			y + 104,
			{ size: 12, color: COLORS.secondary, maxWidth: width - 40 }
		)
	} else {
		painter.text("This test run doesn't track time", x + 20, y + 76, {
			size: 14,
			color: COLORS.muted,
		})
	}

	const ctx = painter.ctx
	ctx.beginPath()
	ctx.moveTo(x + 20, y + 124)
	ctx.lineTo(x + width - 20, y + 124)
	ctx.strokeStyle = COLORS.border
	ctx.stroke()

	const keys = linkedIssueKeys(data.testCaseRuns)
	painter.cardTitle(ICONS.bug, 'Jira bugs', x + 20, y + 160)
	painter.text(String(keys.length), x + width - 20, y + 160, {
		size: 18,
		weight: 800,
		color: COLORS.text,
		align: 'right',
	})
	if (keys.length === 0) {
		painter.text('No Jira issues linked to these test cases', x + 20, y + 190, {
			size: 13,
			color: COLORS.muted,
		})
		return
	}

	const rows = Math.floor((height - 176) / 26)
	const shown = keys.slice(0, keys.length > rows ? rows - 1 : rows)
	shown.forEach((key, index) => {
		const rowY = y + 194 + index * 26
		const issue = data.jiraIssues.find((issue) => issue.issueKey === key)
		const keyWidth = painter.text(key, x + 20, rowY, {
			size: 13,
			weight: 700,
			color: COLORS.text,
		})
		let summaryX = x + 20 + keyWidth + 10
		if (issue?.status) {
			const pill = ISSUE_PILLS[issue.statusCategory ?? ''] ?? ISSUE_PILLS.new
			const pillWidth = painter.measure(issue.status, 11, 600) + 14
			painter.rect(summaryX, rowY - 13, pillWidth, 18, 9, pill.fill)
			painter.text(issue.status, summaryX + 7, rowY, {
				size: 11,
				weight: 600,
				color: pill.ink,
			})
			summaryX += pillWidth + 8
		}
		painter.text(issue?.summary ?? '', summaryX, rowY, {
			size: 12,
			color: COLORS.secondary,
			maxWidth: x + width - 20 - summaryX,
		})
	})
	if (shown.length < keys.length) {
		painter.text(
			`+${keys.length - shown.length} more in the PDF`,
			x + 20,
			y + 194 + shown.length * 26,
			{ size: 12, color: COLORS.muted }
		)
	}
}

function wrapLines(
	painter: Painter,
	value: string,
	maxWidth: number,
	size: number
) {
	painter.font(size)
	const words = value.split(/\s+/)
	const lines: string[] = []
	let line = ''
	for (const word of words) {
		const candidate = line ? `${line} ${word}` : word
		if (line && painter.ctx.measureText(candidate).width > maxWidth) {
			lines.push(line)
			line = word
		} else {
			line = candidate
		}
	}
	if (line) lines.push(line)
	return lines
}

async function summaryImage(data: ReportData): Promise<Blob> {
	const fontFamily =
		getComputedStyle(document.body).fontFamily || 'system-ui, sans-serif'
	await document.fonts?.ready

	// what was tested, then when
	const subtitle = [
		[
			`${data.project.title} (${data.project.projectShortCode})`,
			`Test run #${data.testRun.testRunNumber}`,
			`Build ${data.testRun.build?.buildNumber ?? 'not set'}`,
		],
		[
			`Created ${formatDate(data.testRun.creationDate)}`,
			...(data.days.length > 0
				? [`Last result ${formatDate(data.days[data.days.length - 1].day)}`]
				: []),
			`Report of ${formatDate(data.generatedAt)}`,
		],
	].map((parts) => parts.join(' · '))

	// the header can wrap, so it is measured on a scratch canvas first
	const scratch = new Painter(
		document
			.createElement('canvas')
			.getContext('2d') as CanvasRenderingContext2D,
		fontFamily
	)
	const titleLines = wrapLines(
		scratch,
		data.testRun.title,
		WIDTH - PAD * 2,
		30
	).slice(0, 2)
	const subtitleLines = subtitle.flatMap((line) =>
		wrapLines(scratch, line, WIDTH - PAD * 2, 14)
	)
	const headerHeight =
		24 + titleLines.length * 36 + subtitleLines.length * 20 + 16
	const tilesHeight = 164
	const statusHeight = 196
	const rowHeight = 330
	const height =
		headerHeight + tilesHeight + GAP + statusHeight + GAP + rowHeight + 44

	const canvas = document.createElement('canvas')
	canvas.width = WIDTH * SCALE
	canvas.height = height * SCALE
	const ctx = canvas.getContext('2d') as CanvasRenderingContext2D
	ctx.scale(SCALE, SCALE)
	const painter = new Painter(ctx, fontFamily)

	painter.rect(0, 0, WIDTH, height, 0, COLORS.page)

	let y = 24
	titleLines.forEach((line) => {
		y += 32
		painter.text(line, PAD, y, { size: 30, weight: 800, color: COLORS.text })
	})
	y += 8
	subtitleLines.forEach((line) => {
		y += 20
		painter.text(line, PAD, y, { size: 14, color: COLORS.secondary })
	})
	y = headerHeight

	const tileWidth = (WIDTH - PAD * 2 - GAP * 2) / 3
	const tile = (index: number) => ({
		x: PAD + index * (tileWidth + GAP),
		y,
		width: tileWidth,
		height: tilesHeight,
	})
	bigTile(painter, tile(0), {
		color: COLORS.passTile,
		icon: ICONS.check,
		value: formatRate(data.passRate),
		label: 'Pass rate',
		detail:
			data.executed > 0
				? `${data.counts.passed} of ${data.executed} executed passed`
				: 'Nothing executed yet',
	})
	bigTile(painter, tile(1), {
		color: COLORS.failTile,
		icon: ICONS.cross,
		value: String(data.counts.failed),
		label: 'Failed',
		detail:
			data.executed > 0
				? `${formatRate(data.counts.failed / data.executed)} of executed`
				: 'Nothing executed yet',
	})
	bigTile(painter, tile(2), {
		color: COLORS.progressTile,
		icon: ICONS.flag,
		value: `${
			data.total > 0 ? Math.round((data.executed / data.total) * 100) : 0
		}%`,
		label: 'Progress',
		detail: `${data.executed} of ${data.total} test cases · ${data.counts.pending} pending`,
		badge: RUN_STATUS_LABELS[data.testRun.status] ?? data.testRun.status,
	})
	y += tilesHeight + GAP

	y += statusCard(painter, data, y) + GAP

	const halfWidth = (WIDTH - PAD * 2 - GAP) / 2
	progressCard(painter, data, {
		x: PAD,
		y,
		width: halfWidth,
		height: rowHeight,
	})
	timeAndBugsCard(painter, data, {
		x: PAD + halfWidth + GAP,
		y,
		width: halfWidth,
		height: rowHeight,
	})
	y += rowHeight

	painter.text('Generated by SparkyTC', PAD, y + 28, {
		size: 12,
		color: COLORS.muted,
	})

	return new Promise((resolve, reject) =>
		canvas.toBlob(
			(blob) =>
				blob ? resolve(blob) : reject(new Error('Unable to draw the summary')),
			'image/png'
		)
	)
}

// ---------------------------------------------------------------------------------------------------------------
// pdf

const PDF_MARGIN = 48
const IMAGE_MAX_PIXELS = 1600

// the standard pdf fonts only cover latin-1
function pdfText(value: string) {
	return value
		.replace(/[‘’]/g, "'")
		.replace(/[“”]/g, '"')
		.replace(/[–—]/g, '-')
		.replace(/…/g, '...')
		.replace(/→/g, '->')
		.replace(/[^\n\t\x20-\x7e\xa0-\xff]/g, '?')
}

function hex(color: string): [number, number, number] {
	const value = parseInt(color.slice(1), 16)
	return [(value >> 16) & 255, (value >> 8) & 255, value & 255]
}

/** A downscaled JPEG of an attachment, or undefined when it can't be read as an image. */
async function loadImage(
	attachmentID: string
): Promise<{ data: string; width: number; height: number } | undefined> {
	try {
		const response = await fetch(Route.attachment(attachmentID))
		if (!response.ok) return undefined
		const bitmap = await createImageBitmap(await response.blob())
		const scale = Math.min(
			1,
			IMAGE_MAX_PIXELS / Math.max(bitmap.width, bitmap.height)
		)
		const canvas = document.createElement('canvas')
		canvas.width = Math.round(bitmap.width * scale)
		canvas.height = Math.round(bitmap.height * scale)
		const ctx = canvas.getContext('2d') as CanvasRenderingContext2D
		// transparent images get a white background, as JPEG has no transparency
		ctx.fillStyle = '#ffffff'
		ctx.fillRect(0, 0, canvas.width, canvas.height)
		ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
		bitmap.close()
		return {
			data: canvas.toDataURL('image/jpeg', 0.85),
			width: canvas.width,
			height: canvas.height,
		}
	} catch {
		return undefined
	}
}

const PDF_STATUS_COLORS: Record<
	TestCaseRunStatus,
	{ fill: string; ink: string }
> = {
	[TestCaseRunStatus.pass]: { fill: COLORS.pass, ink: '#ffffff' },
	[TestCaseRunStatus.fail]: { fill: COLORS.failTile, ink: '#ffffff' },
	[TestCaseRunStatus.skip]: { fill: COLORS.skip, ink: COLORS.text },
	[TestCaseRunStatus.blocked]: { fill: COLORS.blocked, ink: '#ffffff' },
	[TestCaseRunStatus.pending]: { fill: COLORS.pending, ink: COLORS.text },
}

async function casesPdf(data: ReportData): Promise<Blob> {
	const { jsPDF } = await import('jspdf')
	const doc = new jsPDF({ unit: 'pt', format: 'a4' })
	const pageWidth = doc.internal.pageSize.getWidth()
	const pageHeight = doc.internal.pageSize.getHeight()
	const contentWidth = pageWidth - PDF_MARGIN * 2
	const bottom = pageHeight - PDF_MARGIN - 16
	const origin = window.location.origin
	let y = PDF_MARGIN

	const ensureSpace = (height: number) => {
		if (y + height > bottom) {
			doc.addPage()
			y = PDF_MARGIN
		}
	}
	const setColor = (color: string) => doc.setTextColor(...hex(color))
	// writes wrapped text and moves down, starting a new page between lines when needed
	const paragraph = (
		value: string,
		options: {
			size: number
			style?: string
			color?: string
			indent?: number
			gap?: number
		}
	) => {
		doc.setFont('helvetica', options.style ?? 'normal')
		doc.setFontSize(options.size)
		setColor(options.color ?? COLORS.text)
		const lineHeight = options.size * 1.35
		const lines: string[] = doc.splitTextToSize(
			pdfText(value),
			contentWidth - (options.indent ?? 0)
		)
		for (const line of lines) {
			ensureSpace(lineHeight)
			doc.text(line, PDF_MARGIN + (options.indent ?? 0), y + options.size)
			y += lineHeight
		}
		y += options.gap ?? 0
	}
	const pill = (
		label: string,
		status: TestCaseRunStatus,
		right: number,
		top: number
	) => {
		doc.setFont('helvetica', 'bold')
		doc.setFontSize(9)
		const width = doc.getTextWidth(label) + 14
		const colors = PDF_STATUS_COLORS[status]
		doc.setFillColor(...hex(colors.fill))
		doc.roundedRect(right - width, top, width, 16, 8, 8, 'F')
		setColor(colors.ink)
		doc.text(label, right - width + 7, top + 11.5)
		return width
	}

	// an image is embedded when asked, anything else is a link to SparkyTC
	const writeAttachment = async (
		attachment: TestCaseAttachment,
		embed: boolean
	) => {
		const url = `${origin}${Route.attachment(attachment.attachmentID)}`
		if (embed && attachment.contentType.startsWith('image/')) {
			const image = await loadImage(attachment.attachmentID)
			if (image) {
				const scale = Math.min(
					(contentWidth - 12) / image.width,
					320 / image.height,
					1
				)
				const width = image.width * scale
				const height = image.height * scale
				ensureSpace(height + 18)
				doc.addImage(image.data, 'JPEG', PDF_MARGIN + 12, y, width, height)
				doc.setDrawColor(...hex(COLORS.border))
				doc.rect(PDF_MARGIN + 12, y, width, height)
				y += height + 4
				paragraph(attachment.fileName, {
					size: 8,
					color: COLORS.muted,
					indent: 12,
					gap: 6,
				})
				return
			}
		}
		ensureSpace(14)
		doc.setFont('helvetica', 'normal')
		doc.setFontSize(9)
		setColor(COLORS.brand)
		const kind = attachment.contentType.startsWith('video/')
			? 'Video'
			: attachment.contentType.startsWith('image/')
			? 'Image'
			: 'File'
		doc.textWithLink(
			pdfText(`${kind}: ${attachment.fileName} (open in SparkyTC)`),
			PDF_MARGIN + 12,
			y + 9,
			{ url }
		)
		y += 14
	}

	// summary of the run
	paragraph('Test run report', {
		size: 10,
		style: 'bold',
		color: COLORS.brand,
		gap: 4,
	})
	paragraph(data.testRun.title, { size: 20, style: 'bold', gap: 6 })
	paragraph(
		[
			`${data.project.title} (${data.project.projectShortCode})`,
			`Test run #${data.testRun.testRunNumber}`,
			`Build ${data.testRun.build?.buildNumber ?? 'not set'}`,
			RUN_STATUS_LABELS[data.testRun.status] ?? data.testRun.status,
		].join(' · '),
		{ size: 10, color: COLORS.secondary }
	)
	paragraph(
		[
			`Created ${formatDate(data.testRun.creationDate)}${
				data.testRun.createdBy ? ` by ${data.testRun.createdBy}` : ''
			}`,
			`Report of ${formatDate(data.generatedAt, true)}`,
		].join(' · '),
		{ size: 10, color: COLORS.secondary, gap: 10 }
	)
	paragraph(
		`${data.counts.passed} passed · ${data.counts.failed} failed · ${
			data.counts.blocked
		} blocked · ${data.counts.skipped} skipped · ${
			data.counts.pending
		} pending · pass rate ${formatRate(data.passRate)}${
			data.time.trackTime
				? ` · time spent ${formatDuration(data.time.totalSeconds)}`
				: ''
		}`,
		{ size: 11, style: 'bold', gap: 4 }
	)
	if (data.testRun.description) {
		paragraph(data.testRun.description, {
			size: 10,
			color: COLORS.secondary,
			gap: 4,
		})
	}
	y += 12

	const executed = data.testCaseRuns
		.filter((run) => run.status !== TestCaseRunStatus.pending)
		.sort((a, b) => a.testCase.testCaseNumber - b.testCase.testCaseNumber)
	paragraph(`Executed test cases (${executed.length})`, {
		size: 14,
		style: 'bold',
		gap: 6,
	})
	if (executed.length === 0) {
		paragraph('No results have been recorded yet.', {
			size: 10,
			color: COLORS.muted,
		})
	}

	for (const run of executed) {
		ensureSpace(80)
		doc.setDrawColor(...hex(COLORS.border))
		doc.line(PDF_MARGIN, y, pageWidth - PDF_MARGIN, y)
		y += 12

		const pillWidth = pill(
			STATUS_LABELS[run.status],
			run.status,
			pageWidth - PDF_MARGIN,
			y
		)
		doc.setFont('helvetica', 'bold')
		doc.setFontSize(12)
		setColor(COLORS.text)
		const titleLines: string[] = doc.splitTextToSize(
			pdfText(
				`${Tools.testCaseDisplayCode(data.project, run.testCase)}  ${run.title}`
			),
			contentWidth - pillWidth - 12
		)
		titleLines.forEach((line, index) => {
			doc.text(line, PDF_MARGIN, y + 12 + index * 16)
		})
		y += Math.max(20, titleLines.length * 16) + 2

		if (data.testRun.trackTime && run.timeSeconds > 0) {
			paragraph(`Time ${formatDuration(run.timeSeconds)}`, {
				size: 9,
				color: COLORS.muted,
				gap: 4,
			})
		}

		const links = run.testCase.jiraLinks ?? []
		if (links.length > 0) {
			paragraph(
				`Jira: ${links
					.map((link) => {
						const issue = data.jiraIssues.find(
							(issue) => issue.issueKey === link.issueKey
						)
						return issue?.status
							? `${link.issueKey} (${issue.status})`
							: link.issueKey
					})
					.join(', ')}`,
				{ size: 9, color: COLORS.secondary, gap: 4 }
			)
		}

		// every result in the order it was recorded, the last one is the status
		for (const [index, result] of run.results.entries()) {
			ensureSpace(48)
			const isLatest = index === run.results.length - 1
			doc.setFont('helvetica', 'bold')
			doc.setFontSize(9)
			const badgeWidth = doc.getTextWidth(STATUS_LABELS[result.status]) + 14
			pill(
				STATUS_LABELS[result.status],
				result.status,
				PDF_MARGIN + badgeWidth,
				y
			)
			doc.setFont('helvetica', 'normal')
			doc.setFontSize(9)
			setColor(COLORS.muted)
			doc.text(
				pdfText(
					[
						`Result ${index + 1} of ${run.results.length}${
							isLatest ? ' (current)' : ''
						}`,
						result.recordedBy ? `by ${result.recordedBy}` : undefined,
						formatDate(result.recordedAt, true),
					]
						.filter(Boolean)
						.join(' · ')
				),
				PDF_MARGIN + badgeWidth + 8,
				y + 11.5
			)
			y += 22
			if (result.notes?.trim()) {
				paragraph(result.notes.trim(), { size: 10, indent: 12, gap: 4 })
			} else {
				paragraph('No comment', {
					size: 10,
					style: 'italic',
					color: COLORS.muted,
					indent: 12,
					gap: 4,
				})
			}
			// evidence: images are embedded, videos are linked
			for (const attachment of result.attachments) {
				await writeAttachment(attachment, true)
			}
			y += 4
		}

		// the test case's own attachments are reference material, linked only
		const references = run.testCase.attachments ?? []
		if (references.length > 0) {
			paragraph('Test case attachments', {
				size: 9,
				style: 'bold',
				color: COLORS.secondary,
				gap: 1,
			})
			for (const attachment of references) {
				await writeAttachment(attachment, false)
			}
		}
		y += 8
	}

	const pending = data.testCaseRuns
		.filter((run) => run.status === TestCaseRunStatus.pending)
		.sort((a, b) => a.testCase.testCaseNumber - b.testCase.testCaseNumber)
	if (pending.length > 0) {
		y += 6
		ensureSpace(40)
		paragraph(`Not executed (${pending.length})`, {
			size: 14,
			style: 'bold',
			gap: 4,
		})
		for (const run of pending) {
			paragraph(
				`${Tools.testCaseDisplayCode(data.project, run.testCase)}  ${
					run.title
				}`,
				{ size: 10, color: COLORS.secondary }
			)
		}
	}

	// footer on every page
	const pages = doc.getNumberOfPages()
	for (let page = 1; page <= pages; page++) {
		doc.setPage(page)
		doc.setFont('helvetica', 'normal')
		doc.setFontSize(8)
		setColor(COLORS.muted)
		doc.text(
			pdfText(
				`SparkyTC · ${data.project.projectShortCode} test run #${data.testRun.testRunNumber}`
			),
			PDF_MARGIN,
			pageHeight - PDF_MARGIN / 2
		)
		doc.text(
			`Page ${page} of ${pages}`,
			pageWidth - PDF_MARGIN,
			pageHeight - PDF_MARGIN / 2,
			{
				align: 'right',
			}
		)
	}

	return doc.output('blob')
}

/** Builds the report and downloads it as a .zip with summary.png and test-cases.pdf in a folder. */
export async function downloadTestRunReport(input: TestRunReportInput) {
	const jiraIssues = await loadJiraIssues(linkedIssueKeys(input.testCaseRuns))
	const data = reportData(input, jiraIssues)
	const [{ default: JSZip }, image, pdf] = await Promise.all([
		import('jszip'),
		summaryImage(data),
		casesPdf(data),
	])

	const name = `${input.project.projectShortCode}-test-run-${input.testRun.testRunNumber}-report`
	const zip = new JSZip()
	const folder = zip.folder(name) as InstanceType<typeof JSZip>
	folder.file('summary.png', image)
	folder.file('test-cases.pdf', pdf)
	const blob = await zip.generateAsync({ type: 'blob' })

	const url = URL.createObjectURL(blob)
	const link = document.createElement('a')
	link.href = url
	link.download = `${name}.zip`
	document.body.appendChild(link)
	link.click()
	link.remove()
	setTimeout(() => URL.revokeObjectURL(url), 1000)
}
