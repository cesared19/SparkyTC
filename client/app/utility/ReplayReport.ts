import { TestCaseAttachment, TestCaseResult } from '~/models/types'

/** One screenshot checkpoint of a replay, compared with the recording. */
export interface ReplayScreenshot {
	name: string
	// percentage of pixels that differ, 0–100
	differentPercent?: number
	passed?: boolean
}

export interface ReplayMetricSet {
	averageFps?: number
	frameTimeP50Ms?: number
	frameTimeP95Ms?: number
	frameTimeP99Ms?: number
	overBudgetPercent?: number
	droppedFrames?: number
	cpuAvgMs?: number
	gpuAvgMs?: number
	usedMemoryPeakMB?: number
	batteryTemperatureMaxC?: number
}

/** What an app (re-Play) reported with a result through the integration API. */
export interface ReplayReport {
	passed?: boolean
	findings: string[]
	screenshots: ReplayScreenshot[]
	recorded?: ReplayMetricSet
	replay?: ReplayMetricSet
}

const isObject = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null && !Array.isArray(value)

const numberOrUndefined = (value: unknown) =>
	typeof value === 'number' && Number.isFinite(value) ? value : undefined

function metricSet(value: unknown): ReplayMetricSet | undefined {
	if (!isObject(value)) return undefined
	const set: ReplayMetricSet = {}
	for (const metric of REPLAY_METRICS) {
		set[metric.key] = numberOrUndefined(value[metric.key])
	}
	return set
}

/** The result's report, or undefined when it has none or it can't be read. */
export function replayReport(result: TestCaseResult): ReplayReport | undefined {
	if (!result.report) return undefined
	let data: unknown
	try {
		data = JSON.parse(result.report)
	} catch {
		return undefined
	}
	if (!isObject(data)) return undefined
	const metrics = isObject(data.metrics) ? data.metrics : {}
	return {
		passed: typeof data.passed === 'boolean' ? data.passed : undefined,
		findings: Array.isArray(data.findings)
			? data.findings.filter((f): f is string => typeof f === 'string')
			: [],
		screenshots: Array.isArray(data.screenshots)
			? data.screenshots.filter(isObject).map((shot) => ({
					name: typeof shot.name === 'string' ? shot.name : '',
					differentPercent: numberOrUndefined(shot.differentPercent),
					passed: typeof shot.passed === 'boolean' ? shot.passed : undefined,
				}))
			: [],
		recorded: metricSet(metrics.recorded),
		replay: metricSet(metrics.replay),
	}
}

/** The latest result's report of a test case in a run. */
export function latestReplayReport(results: TestCaseResult[]) {
	const latest = results[results.length - 1]
	return latest ? replayReport(latest) : undefined
}

export interface ReplayMetric {
	key: keyof ReplayMetricSet
	label: string
	unit: string
	// whether a lower value is better (frame times) or a higher one (FPS)
	lowerIsBetter: boolean
	digits: number
}

export const REPLAY_METRICS: ReplayMetric[] = [
	{
		key: 'averageFps',
		label: 'Average FPS',
		unit: '',
		lowerIsBetter: false,
		digits: 1,
	},
	{
		key: 'frameTimeP50Ms',
		label: 'Frame time p50',
		unit: ' ms',
		lowerIsBetter: true,
		digits: 1,
	},
	{
		key: 'frameTimeP95Ms',
		label: 'Frame time p95',
		unit: ' ms',
		lowerIsBetter: true,
		digits: 1,
	},
	{
		key: 'frameTimeP99Ms',
		label: 'Frame time p99',
		unit: ' ms',
		lowerIsBetter: true,
		digits: 1,
	},
	{
		key: 'overBudgetPercent',
		label: 'Frames over budget',
		unit: '%',
		lowerIsBetter: true,
		digits: 1,
	},
	{
		key: 'droppedFrames',
		label: 'Dropped frames',
		unit: '',
		lowerIsBetter: true,
		digits: 0,
	},
	{
		key: 'cpuAvgMs',
		label: 'CPU average',
		unit: ' ms',
		lowerIsBetter: true,
		digits: 1,
	},
	{
		key: 'gpuAvgMs',
		label: 'GPU average',
		unit: ' ms',
		lowerIsBetter: true,
		digits: 1,
	},
	{
		key: 'usedMemoryPeakMB',
		label: 'Memory peak',
		unit: ' MB',
		lowerIsBetter: true,
		digits: 0,
	},
	{
		key: 'batteryTemperatureMaxC',
		label: 'Battery temperature max',
		unit: ' °C',
		lowerIsBetter: true,
		digits: 1,
	},
]

// a replay that's this much worse than its recording is highlighted, like re-Play's own regression check
export const REGRESSION_PERCENT = 20

/** How much worse the replay is than the recording, in percent (negative when better); undefined without both. */
export function worsePercent(
	metric: ReplayMetric,
	recorded?: number,
	replay?: number
) {
	if (recorded === undefined || replay === undefined) return undefined
	if (recorded === 0) return replay === 0 ? 0 : undefined
	const change = ((replay - recorded) / Math.abs(recorded)) * 100
	return metric.lowerIsBetter ? change : -change
}

export function formatMetric(metric: ReplayMetric, value?: number) {
	if (value === undefined) return '—'
	return `${value.toFixed(metric.digits)}${metric.unit}`
}

/**
 * The evidence files of a screenshot checkpoint, which re-Play names "<screenshot>.recording.png",
 * "<screenshot>.replay.png" and "<screenshot>.diff.png".
 */
export function screenshotFiles(
	name: string,
	attachments: TestCaseAttachment[]
) {
	const prefix = `${name}.`
	return attachments
		.filter((attachment) => attachment.fileName.startsWith(prefix))
		.map((attachment) => ({
			attachment,
			label: attachment.fileName.slice(prefix.length).split('.')[0] || 'image',
		}))
}

/** "Passed" / "Failed" and how many screenshots match, for one line summaries and the export. */
export function replaySummary(report: ReplayReport) {
	const overall =
		report.passed === undefined
			? 'Reported'
			: report.passed
				? 'Passed'
				: 'Failed'
	if (report.screenshots.length === 0) return overall
	const matching = report.screenshots.filter((shot) => shot.passed).length
	return `${overall}, ${matching}/${report.screenshots.length} screenshots match`
}
