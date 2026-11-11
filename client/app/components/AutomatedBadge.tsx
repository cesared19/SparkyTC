// a test run created through the integration API (e.g. re-Play), not by a person in the app
export function AutomatedBadge() {
	return (
		<span
			title="Created through the integration API"
			className="inline-flex rounded-full px-2 text-xs font-semibold leading-5 bg-indigo-100 text-indigo-800"
		>
			AUTOMATED
		</span>
	)
}
