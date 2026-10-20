import { useEffect, useRef, useState } from 'react'
import { BuildResultCounts } from '~/models/types'

export interface RatePoint {
	id: string
	// short label under the x axis, e.g. #12
	label: string
	// shown in the tooltip and the table
	title: string
	counts: BuildResultCounts
}

// drawn at the container's width so the text keeps its size on phones and wide screens
const DEFAULT_WIDTH = 640
const HEIGHT = 220
const PADDING = { top: 20, right: 12, bottom: 28, left: 40 }
const PLOT_HEIGHT = HEIGHT - PADDING.top - PADDING.bottom
const GRID_STEPS = [0, 0.25, 0.5, 0.75, 1]
const MAX_BAR_WIDTH = 24
// the surface gap between stacked segments
const SEGMENT_GAP = 2
const CORNER_RADIUS = 4
// fewer x labels than bars once they would collide
const MIN_X_LABEL_SPACING = 64

// bottom to top; the pending part on top shows how much of the build is left
const SEGMENTS = [
	{
		key: 'passed' as const,
		label: 'Passed',
		color: 'rgb(var(--color-chart-pass))',
	},
	{
		key: 'failed' as const,
		label: 'Failed',
		color: 'rgb(var(--color-chart-fail))',
	},
	{
		key: 'skipped' as const,
		label: 'Skipped',
		color: 'rgb(var(--color-chart-skip))',
	},
	{
		key: 'pending' as const,
		label: 'Pending',
		color: 'rgb(var(--color-gray-300))',
	},
]

export function formatRate(rate?: number | null) {
	return rate === null || rate === undefined
		? '-'
		: `${Math.round(rate * 100)}%`
}

function Legend() {
	return (
		<div className="flex flex-wrap gap-4 text-xs text-gray-600">
			{SEGMENTS.map((segment) => (
				<span key={segment.key} className="inline-flex items-center gap-1.5">
					<span
						className="h-2.5 w-2.5 rounded-sm"
						style={{ backgroundColor: segment.color }}
						aria-hidden="true"
					/>
					{segment.label}
				</span>
			))}
		</div>
	)
}

function countsSummary(counts: BuildResultCounts) {
	return `${counts.passed} passed · ${counts.failed} failed · ${counts.skipped} skipped · ${counts.pending} pending`
}

const TOOLTIP_WIDTH = 224

/** Beside the hovered bar, on the side with more room, without leaving the chart. */
function tooltipLeft(x: number, width: number) {
	const left = x > width / 2 ? x - 16 - TOOLTIP_WIDTH : x + 16
	return Math.max(0, Math.min(left, width - TOOLTIP_WIDTH))
}

/** A rectangle with rounded top corners, for the top segment of a bar. */
function roundedTop(x: number, y: number, width: number, height: number) {
	const r = Math.min(CORNER_RADIUS, width / 2, height)
	return `M${x},${y + height} V${y + r} Q${x},${y} ${x + r},${y} H${
		x + width - r
	} Q${x + width},${y} ${x + width},${y + r} V${y + height} Z`
}

/**
 * Results over a sequence of points, such as the test runs of a build or the builds of a project. Each
 * bar stacks the passed, failed, skipped and pending test cases, so it shows both quality and progress.
 */
export function RateChart({
	points,
	firstColumn,
}: {
	points: RatePoint[]
	// header of the table view's first column
	firstColumn: string
}) {
	const [hovered, setHovered] = useState<number | null>(null)
	const containerRef = useRef<HTMLDivElement>(null)
	const [width, setWidth] = useState(DEFAULT_WIDTH)

	useEffect(() => {
		const container = containerRef.current
		if (!container) return
		const observer = new ResizeObserver(([entry]) =>
			setWidth(Math.max(280, Math.round(entry.contentRect.width)))
		)
		observer.observe(container)
		return () => observer.disconnect()
	}, [])

	const plotWidth = width - PADDING.left - PADDING.right
	const band = plotWidth / points.length
	const barWidth = Math.min(MAX_BAR_WIDTH, band * 0.6)
	const center = (index: number) => PADDING.left + band * (index + 0.5)
	const y = (share: number) => PADDING.top + (1 - share) * PLOT_HEIGHT
	const labelEvery = Math.max(1, Math.ceil(MIN_X_LABEL_SPACING / band))
	const last = points[points.length - 1]
	const hoveredPoint = hovered === null ? undefined : points[hovered]

	return (
		<div className="space-y-2">
			<Legend />
			<div className="relative" ref={containerRef}>
				<svg
					viewBox={`0 0 ${width} ${HEIGHT}`}
					width={width}
					height={HEIGHT}
					className="block max-w-full"
					role="img"
					aria-label={`Pass rate ${formatRate(
						last.counts.passRate
					)} and fail rate ${formatRate(last.counts.failRate)} at ${
						last.label
					}`}
					onMouseLeave={() => setHovered(null)}
				>
					{GRID_STEPS.map((step) => (
						<g key={step}>
							<line
								x1={PADDING.left}
								x2={width - PADDING.right}
								y1={y(step)}
								y2={y(step)}
								stroke="rgb(var(--color-gray-200))"
								strokeWidth="1"
							/>
							<text
								x={PADDING.left - 8}
								y={y(step)}
								textAnchor="end"
								dominantBaseline="middle"
								className="fill-gray-500 text-[11px]"
							>
								{step * 100}%
							</text>
						</g>
					))}

					{points.map((point, index) => {
						const total = point.counts.testCaseCount
						const segments = SEGMENTS.map((segment) => ({
							...segment,
							value: point.counts[segment.key],
						})).filter((segment) => segment.value > 0)
						let below = 0
						const x = center(index) - barWidth / 2
						return (
							<g
								key={point.id}
								opacity={hovered === null || hovered === index ? 1 : 0.55}
							>
								{total > 0 &&
									segments.map((segment, segmentIndex) => {
										const bottom = y(below / total)
										below += segment.value
										const top = y(below / total)
										// the gap comes off the top of every segment except the last
										const isTop = segmentIndex === segments.length - 1
										const height = Math.max(
											0,
											bottom - top - (isTop ? 0 : SEGMENT_GAP)
										)
										const segmentTop = isTop ? top : top + SEGMENT_GAP
										return isTop ? (
											<path
												key={segment.key}
												d={roundedTop(x, segmentTop, barWidth, height)}
												fill={segment.color}
											/>
										) : (
											<rect
												key={segment.key}
												x={x}
												y={segmentTop}
												width={barWidth}
												height={height}
												fill={segment.color}
											/>
										)
									})}
								{(index % labelEvery === 0 || index === points.length - 1) && (
									<text
										x={center(index)}
										y={HEIGHT - 8}
										textAnchor="middle"
										className="fill-gray-500 text-[11px]"
									>
										{point.label}
									</text>
								)}
							</g>
						)
					})}

					{/* the latest pass rate above its bar */}
					<text
						x={center(points.length - 1)}
						y={PADDING.top - 6}
						textAnchor="middle"
						className="fill-gray-700 text-[11px] font-medium"
					>
						{formatRate(last.counts.passRate)} pass
					</text>

					{/* hover targets wider than the bars */}
					{points.map((point, index) => (
						<rect
							key={point.id}
							x={center(index) - band / 2}
							y={PADDING.top}
							width={band}
							height={PLOT_HEIGHT}
							fill="transparent"
							onMouseEnter={() => setHovered(index)}
						/>
					))}
				</svg>

				{hoveredPoint && hovered !== null && (
					<div
						className="pointer-events-none absolute top-0 z-10 w-56 rounded-md border border-gray-200 bg-white p-2 text-xs shadow-lg"
						style={{ left: tooltipLeft(center(hovered), width) }}
					>
						<div className="font-medium text-gray-900">
							{hoveredPoint.title}
						</div>
						<div className="mt-1 grid grid-cols-2 gap-x-2 text-gray-700">
							<span>Pass rate</span>
							<span className="text-right tabular-nums">
								{formatRate(hoveredPoint.counts.passRate)}
							</span>
							<span>Fail rate</span>
							<span className="text-right tabular-nums">
								{formatRate(hoveredPoint.counts.failRate)}
							</span>
						</div>
						<div className="mt-1 text-gray-500">
							{countsSummary(hoveredPoint.counts)}
						</div>
					</div>
				)}
			</div>

			<details className="text-sm">
				<summary className="cursor-pointer text-xs font-medium text-gray-600 hover:text-gray-900">
					Show as table
				</summary>
				<div className="mt-2 overflow-x-auto">
					<table className="min-w-full text-xs">
						<thead>
							<tr className="text-left text-gray-500">
								{[firstColumn, 'Pass rate', 'Fail rate', 'Results'].map(
									(header) => (
										<th key={header} className="py-1 pr-4 font-medium">
											{header}
										</th>
									)
								)}
							</tr>
						</thead>
						<tbody className="text-gray-700">
							{points.map((point) => (
								<tr key={point.id}>
									<td className="py-1 pr-4">{point.title}</td>
									<td className="py-1 pr-4 tabular-nums">
										{formatRate(point.counts.passRate)}
									</td>
									<td className="py-1 pr-4 tabular-nums">
										{formatRate(point.counts.failRate)}
									</td>
									<td className="py-1 pr-4">{countsSummary(point.counts)}</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			</details>
		</div>
	)
}
