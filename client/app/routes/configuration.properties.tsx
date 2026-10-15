import { LoaderFunctionArgs } from '@remix-run/node'
import { APIRoute } from '~/utility/Routes'
import {
	PropertyConfigurationOutletContext,
	PropertyConfigurationResponse,
} from '~/models/types'
import { Outlet, useLoaderData } from '@remix-run/react'
import { requireAPI } from '~/utility/API.server'

export async function loader({ request }: LoaderFunctionArgs) {
	const api = await requireAPI(request)
	return api.get<PropertyConfigurationResponse>(APIRoute.properties)
}

export default function ConfigurationProperties() {
	const { data } = useLoaderData<typeof loader>()

	const outletContext: PropertyConfigurationOutletContext = {
		properties: data,
	}

	return <Outlet context={outletContext} />
}
