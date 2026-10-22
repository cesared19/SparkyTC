import { Outlet, useOutletContext } from '@remix-run/react'
import { useParams } from '@remix-run/react'
import {
	PropertyConfigurationDetailsOutletContext,
	PropertyConfigurationOutletContext,
} from '~/models/types'

export default function PropertyDetailsIndex() {
	// hooks before any early return, so they run in the same order on every render
	const { propertyID } = useParams()
	const { properties } = useOutletContext<PropertyConfigurationOutletContext>()
	if (!propertyID) {
		return <div>Property ID not found</div>
	}

	const property = properties.find(
		(property) => property.propertyConfigurationID === propertyID
	)
	if (!property) {
		return <div>Property not found</div>
	}

	const outletContext: PropertyConfigurationDetailsOutletContext = {
		property,
	}

	return <Outlet context={outletContext} />
}
