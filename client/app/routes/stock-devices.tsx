import { type LoaderFunctionArgs } from 'react-router'
import { FetchResponse, StockDevice } from '~/models/types'
import { requireAPI } from '~/utility/API.server'
import { APIRoute } from '~/utility/Routes'
import { Tools } from '~/utility/Tools'

// SparkStock devices for the device picker of a result: without a search, the ones the user has
export async function loader({ request }: LoaderFunctionArgs) {
	const api = await requireAPI(request)
	const query = new URL(request.url).searchParams.get('q')?.trim() ?? ''
	try {
		const response = await api.get<FetchResponse<StockDevice[]>>(
			APIRoute.stockDevices(query ? { query } : { mine: true }),
		)
		return { devices: response.data, query }
	} catch (error) {
		return {
			devices: [] as StockDevice[],
			query,
			...Tools.mapErrorToResponse(error),
		}
	}
}
