import { useFetcher } from '@remix-run/react'
import { useEffect, useId, useState } from 'react'
import { StockDevice } from '~/models/types'
import { deviceText } from '~/utility/Devices'
import { Route } from '~/utility/Routes'

type DeviceList = { devices: StockDevice[]; query: string; message?: string }

/**
 * Picks the SparkStock device a result was recorded on: the tester's own devices first, a search over every
 * device, or the asset tag typed by hand when SparkStock can't be reached.
 */
export function DevicePicker({
	value,
	onChange,
	required,
	disabled,
}: {
	value: string
	onChange: (ref: string) => void
	required: boolean
	disabled?: boolean
}) {
	const id = useId()
	const mine = useFetcher<DeviceList>()
	const search = useFetcher<DeviceList>()
	const [query, setQuery] = useState('')

	useEffect(() => {
		if (mine.state === 'idle' && !mine.data) mine.load(Route.stockDevices())
		// loads the user's devices once
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [])

	useEffect(() => {
		const text = query.trim()
		if (text.length < 2) return
		const timer = setTimeout(() => search.load(Route.stockDevices(text)), 300)
		return () => clearTimeout(timer)
		// search only changes with the query
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [query])

	const unavailable = mine.data?.message
	const own = mine.data?.devices ?? []
	const found = query.trim().length >= 2 ? search.data?.devices ?? [] : []
	const options = [
		...own,
		...found.filter((d) => !own.some((o) => o.ref === d.ref)),
	]
	const selected = options.find((d) => d.ref === value)

	return (
		<div className="mt-4 max-w-xl space-y-2" data-testid="device-picker">
			<label
				htmlFor={`${id}-device`}
				className="block text-sm font-medium text-gray-900"
			>
				Device{required ? '' : ' (optional)'}
			</label>
			{unavailable ? (
				<>
					<input
						id={`${id}-device`}
						value={value}
						onChange={(event) => onChange(event.target.value.toUpperCase())}
						disabled={disabled}
						placeholder="Asset tag, e.g. VR-0001"
						className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm uppercase focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
					/>
					<p className="text-xs text-yellow-800">
						SparkStock can&apos;t be reached, type the asset tag on the
						device&apos;s label.
					</p>
				</>
			) : (
				<>
					<select
						id={`${id}-device`}
						value={value}
						onChange={(event) => onChange(event.target.value)}
						disabled={disabled || mine.state === 'loading'}
						className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:opacity-60"
					>
						<option value="">
							{mine.state === 'loading'
								? 'Loading your devices…'
								: 'Choose a device'}
						</option>
						{value && !selected && <option value={value}>{value}</option>}
						{own.length > 0 && (
							<optgroup label="Your devices">
								{own.map((device) => (
									<option key={device.ref} value={device.ref}>
										{deviceText(device)}
									</option>
								))}
							</optgroup>
						)}
						{found.length > 0 && (
							<optgroup label="Search results">
								{options
									.filter((d) => !own.some((o) => o.ref === d.ref))
									.map((device) => (
										<option key={device.ref} value={device.ref}>
											{deviceText(device)}
											{device.holderName ? ` — with ${device.holderName}` : ''}
										</option>
									))}
							</optgroup>
						)}
					</select>
					<input
						type="search"
						value={query}
						onChange={(event) => setQuery(event.target.value)}
						disabled={disabled}
						aria-label="Search devices in SparkStock"
						placeholder="Not yours? Search SparkStock"
						className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
					/>
					{query.trim().length >= 2 &&
						search.state === 'idle' &&
						search.data &&
						found.length === 0 && (
							<p className="text-xs text-gray-500">
								No device matches “{query.trim()}”.
							</p>
						)}
					{own.length === 0 && mine.data && !query && (
						<p className="text-xs text-gray-500">
							You have no device checked out in SparkStock; search for the one
							you used.
						</p>
					)}
				</>
			)}
		</div>
	)
}
