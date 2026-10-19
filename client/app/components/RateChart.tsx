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
const PADDING = { top: 12, right: 72, bottom: 28, left: 40 }
const PLOT_HEIGHT = HEIGHT - PADDING.top - PADDING.bottom
const GRID_STEPS = [0, 0.25, 0.5, 0.75, 1]
// fewer x labels than points once they would collide
const MIN_X_LABEL_SPACING = 64

const SERIES = [
	{
		key: 'passRate' as const,
		label: 'Pass rate',
		color: 'rgb(var(--color-chart-pass))',
		dash: undefined,
	},
	{
		key: 'failRate' as const,
		label: 'Fail rate',
		color: 'rgb(var(--color-chart-fail))',
		// dashed with square markers, so the two lines don't rely on red and green alone
		dash: '6 4',
	},
]

export function formatRate(rate?: number | null) {
	return rate === null || rate === undefined
		? '-'
		: `${Math.round(rate * 100)}%`
}

function Marker({
	seriesKey,
	x,
	y,
	color,
}: {
	seriesKey: 'passRate' | 'failRate'
	x: number
	y: number
	color: string
}) {
	// a surface ring keeps overlapping markers apart
	const ring = { stroke: 'rgb(var(--color-surface))', strokeWidth: 2 }
	return seriesKey === 'passRate' ? (
		<circle cx={x} cy={y} r={4.5} fill={color} {...ring} />
	) : (
		<rect
			x={x - 4.5}
			y={y - 4.5}
			width={9}
			height={9}
			rx={1.5}
			fill={color}
			{...ring}
		/>
	)
}

function RateLegend() {
	return (
		<div className="flex flex-wrap gap-4 text-xs text-gray-600">
			{SERIES.map((series) => (
				<span key={series.key} className="inline-flex items-center gap-1.5">
					<svg width="22" height="10" aria-hidden="true">
						<line
							x1="1"
							x2="21"
							y1="5"
							y2="5"
							stroke={series.color}
							strokeWidth="2"
							strokeDasharray={series.dash}
						/>
						<Marker seriesKey={series.key} x={11} y={5} color={series.color} />
					</svg>
					{series.label}
				</span>
			))}
		</div>
	)
}

function countsSummary(counts: BuildResultCounts) {
	return `${counts.passed} passed · ${counts.failed} failed · ${counts.skipped} skipped · ${counts.pending} pending`
}

/** Pass and fail rate over a sequence of points, such as the test runs of a build or the builds of a project. */
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

	const x = (index: number) =>
		PADDING.left +
		(points.length === 1
			? plotWidth / 2
			: (index / (points.length - 1)) * plotWidth)
	const y = (rate: number) => PADDING.top + (1 - rate) * PLOT_HEIGHT
	const labelEvery = Math.max(
		1,
		Math.ceil((points.length * MIN_X_LABEL_SPACING) / plotWidth)
	)
	const columnWidth =
		points.length === 1 ? plotWidth : plotWidth / (points.length - 1)
	const last = points[points.length - 1]
	const hoveredPoint = hovered === null ? undefined : points[hovered]

	return (
		<div className="space-y-2">
			<RateLegend />
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

					{points.map((point, index) =>
						index % labelEvery === 0 || index === points.length - 1 ? (
							<text
								key={point.id}
								x={x(index)}
								y={HEIGHT - 8}
								textAnchor="middle"
								className="fill-gray-500 text-[11px]"
							>
								{point.label}
							</text>
						) : null
					)}

					{hovered !== null && (
						<line
							x1={x(hovered)}
							x2={x(hovered)}
							y1={PADDING.top}
							y2={PADDING.top + PLOT_HEIGHT}
							stroke="rgb(var(--color-gray-400))"
							strokeWidth="1"
						/>
					)}

					{SERIES.map((series) => {
						const defined = points
							.map((point, index) => ({
								index,
								rate: point.counts[series.key],
							}))
							.filter(
								(entry): entry is { index: number; rate: number } =>
									entry.rate !== null && entry.rate !== undefined
							)
						return (
							<g key={series.key}>
								<polyline
									points={defined
										.map((entry) => `${x(entry.index)},${y(entry.rate)}`)
										.join(' ')}
									fill="none"
									stroke={series.color}
									strokeWidth="2"
									strokeDasharray={series.dash}
									strokeLinejoin="round"
								/>
								{defined.map((entry) => (
									<Marker
										key={entry.index}
										seriesKey={series.key}
										x={x(entry.index)}
										y={y(entry.rate)}
										color={series.color}
									/>
								))}
							</g>
						)
					})}

					{/* direct labels on the latest point */}
					{SERIES.map((series) => {
						const rate = last.counts[series.key]
						if (rate === null || rate === undefined) return null
						const other =
							last.counts[
								series.key === 'passRate' ? 'failRate' : 'passRate'
							] ?? -1
						// keep the two labels apart when the rates are close
						const nudge =
							Math.abs(rate - other) < 0.12 ? (rate >= other ? -8 : 8) : 0
						return (
							<text
								key={series.key}
								x={x(points.length - 1) + 10}
								y={y(rate) + nudge}
								dominantBaseline="middle"
								className="fill-gray-700 text-[11px] font-medium"
							>
								{series.label.split(' ')[0]} {formatRate(rate)}
							</text>
						)
					})}

					{/* hover targets wider than the marks */}
					{points.map((point, index) => (
						<rect
							key={point.id}
							x={x(index) - columnWidth / 2}
							y={PADDING.top}
							width={columnWidth}
							height={PLOT_HEIGHT}
							fill="transparent"
							onMouseEnter={() => setHovered(index)}
							onFocus={() => setHovered(index)}
						/>
					))}
				</svg>

				{hoveredPoint && hovered !== null && (
					<div
						className="pointer-events-none absolute top-0 z-10 w-56 rounded-md border border-gray-200 bg-white p-2 text-xs shadow-lg"
						style={{
							left: `${(x(hovered) / width) * 100}%`,
							transform:
								x(hovered) > width / 2
									? 'translateX(calc(-100% - 12px))'
									: 'translateX(12px)',
						}}
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
