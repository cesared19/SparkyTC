import { useRouteLoaderData } from '@remix-run/react'
import { User, UserRole } from '~/models/types'

/** The signed in user, loaded by the root route. */
export function useCurrentUser() {
	const data = useRouteLoaderData('root') as { user?: User } | undefined
	return data?.user
}

export function useIsAdmin() {
	return useCurrentUser()?.role === UserRole.admin
}
