import { type RouteConfig } from '@remix-run/route-config'
import { flatRoutes } from '@remix-run/fs-routes'

// the routes are the files of app/routes, named as before
export default flatRoutes() satisfies RouteConfig
