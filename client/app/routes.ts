import { type RouteConfig } from '@react-router/dev/routes'
import { flatRoutes } from '@react-router/fs-routes'

// the routes are the files of app/routes, named as before
export default flatRoutes() satisfies RouteConfig
