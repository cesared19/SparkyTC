import { type LoaderFunctionArgs } from '@remix-run/node'
import { Outlet } from '@remix-run/react'
import { requireAdmin } from '~/utility/Authorization.server'
import Sidebar from '~/components/Sidebar'

export async function loader({ request }: LoaderFunctionArgs) {
	await requireAdmin(request)
	return null
}

export default function ConfigurationLayout() {
	return (
		<div className="flex min-h-0 flex-1 flex-col md:flex-row">
			<Sidebar
				title="Configuration"
				items={[{ to: '/configuration/properties', label: 'Properties' }]}
			/>
			<div className="flex-1 overflow-auto p-4 md:p-6">
				<Outlet />
			</div>
		</div>
	)
}
