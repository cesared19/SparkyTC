import { useOutletContext, Link, useNavigate } from '@remix-run/react'
import {
	PropertyConfiguration,
	PropertyConfigurationOutletContext,
} from '~/models/types'
import { Table, type Column } from '~/components/Table'
import { Tools } from '~/utility/Tools'

export default function ConfigurationProperties() {
	const { properties } = useOutletContext<PropertyConfigurationOutletContext>()
	const navigate = useNavigate()

	const columns: Column<PropertyConfiguration>[] = [
		{
			header: 'Title',
			key: 'title',
			mobile: 'title',
			render: (property) => property.title,
		},
		{
			header: 'Type',
			key: 'propertyType',
			render: (property) =>
				Tools.propertyTypeToDisplayText(property.propertyType),
		},
		{
			header: 'Default Value',
			key: 'defaultValue',
			render: (property) => (
				<span className="text-gray-500">{property.defaultValue || '-'}</span>
			),
		},
		{
			header: 'Source',
			key: 'source',
			render: (property) => Tools.capitalizeFirstLetter(property.source),
		},
	]

	return (
		<div>
			<div className="mb-6 flex flex-wrap items-center justify-between gap-3">
				<h2 className="text-2xl font-semibold text-gray-900">Properties</h2>
				<Link
					to="new"
					className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
				>
					New Property
				</Link>
			</div>

			<Table
				tableRows={properties.map((property) => ({
					id: property.propertyConfigurationID,
					data: property,
				}))}
				columns={columns}
				onRowClick={(property) =>
					navigate(property.propertyConfigurationID.toString())
				}
			/>
		</div>
	)
}
