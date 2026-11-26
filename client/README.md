# SparkyTC client

The web app, built with [React Router](https://reactrouter.com) (framework mode, server rendered), React and Tailwind. The routes are the files of `app/routes` (`app/routes.ts` reads them with `flatRoutes`).

## Development

Run the dev server:

```shellscript
npm run dev
```

## Deployment

First, build your app for production:

```sh
npm run build
```

Then run the app in production mode:

```sh
npm start
```

Now you'll need to pick a host to deploy it to.

### DIY

If you're familiar with deploying Node applications, the built-in React Router app server (`react-router-serve`) is production-ready.

Make sure to deploy the output of `npm run build`

-  `build/server`
-  `build/client`

## Styling

The styles are [Tailwind CSS](https://tailwindcss.com/); see the [Vite docs on css](https://vitejs.dev/guide/features.html#css) for how Vite handles them.
