import { useFetcher, useLocation, useNavigate } from '@remix-run/react'
import { useEffect, useRef, useState } from 'react'
import { AppNotification, NotificationList } from '~/models/types'
import { Route } from '~/utility/Routes'

const REFRESH_INTERVAL_MS = 60_000

function timeAgo(date: number) {
	const minutes = Math.round((Date.now() - date) / 60_000)
	if (minutes < 1) return 'just now'
	if (minutes < 60) return `${minutes} min ago`
	const hours = Math.round(minutes / 60)
	if (hours < 24) return `${hours} h ago`
	return new Date(date).toLocaleDateString()
}

export function NotificationBell() {
	const listFetcher = useFetcher<NotificationList>()
	const actionFetcher = useFetcher()
	const navigate = useNavigate()
	const location = useLocation()
	const [isOpen, setIsOpen] = useState(false)
	const containerRef = useRef<HTMLDivElement>(null)

	// refresh on navigation, after marking notifications read, and every minute
	useEffect(() => {
		listFetcher.load(Route.notifications)
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [location.pathname])

	useEffect(() => {
		const interval = setInterval(() => {
			if (document.visibilityState === 'visible') {
				listFetcher.load(Route.notifications)
			}
		}, REFRESH_INTERVAL_MS)
		return () => clearInterval(interval)
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [])

	useEffect(() => {
		if (!isOpen) return
		const close = (event: MouseEvent) => {
			if (!containerRef.current?.contains(event.target as Node))
				setIsOpen(false)
		}
		document.addEventListener('mousedown', close)
		return () => document.removeEventListener('mousedown', close)
	}, [isOpen])

	const data = listFetcher.data
	const unreadCount = data?.unreadCount ?? 0

	// hide deleted notifications while the request is in flight
	const pending =
		actionFetcher.state === 'idle'
			? undefined
			: (actionFetcher.json as Record<string, string> | undefined)
	const notifications = (data?.notifications ?? []).filter(
		(notification) =>
			!(
				(pending?.intent === 'deleteRead' && notification.isRead) ||
				(pending?.intent === 'delete' &&
					pending.notificationID === notification.notificationID)
			)
	)
	const hasRead = notifications.some((notification) => notification.isRead)

	const submit = (body: Record<string, string>) =>
		actionFetcher.submit(body, {
			method: 'post',
			action: Route.notifications,
			encType: 'application/json',
		})

	const open = (notification: AppNotification) => {
		if (!notification.isRead) {
			submit({ intent: 'read', notificationID: notification.notificationID })
		}
		setIsOpen(false)
		if (notification.link) navigate(notification.link)
	}

	return (
		<div className="relative" ref={containerRef}>
			<button
				type="button"
				onClick={() => setIsOpen(!isOpen)}
				aria-label={`Notifications${
					unreadCount ? `, ${unreadCount} unread` : ''
				}`}
				aria-expanded={isOpen}
				className="relative rounded-md p-1.5 text-gray-600 hover:bg-gray-100 hover:text-gray-900"
			>
				<svg
					className="h-5 w-5"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
					strokeWidth="2"
					aria-hidden="true"
				>
					<path
						strokeLinecap="round"
						strokeLinejoin="round"
						d="M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 00-4-5.7V5a2 2 0 10-4 0v.3A6 6 0 006 11v3.2c0 .5-.2 1-.6 1.4L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
					/>
				</svg>
				{unreadCount > 0 && (
					<span className="absolute -right-1 -top-1 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-brand-600 px-1 text-[10px] font-semibold text-white">
						{unreadCount > 99 ? '99+' : unreadCount}
					</span>
				)}
			</button>

			{isOpen && (
				<div className="fixed inset-x-2 top-14 z-30 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg md:absolute md:inset-x-auto md:right-0 md:top-auto md:mt-2 md:w-96">
					<div className="flex items-center justify-between border-b border-gray-200 px-4 py-2">
						<span className="text-sm font-semibold text-gray-900">
							Notifications
						</span>
						<div className="flex items-center gap-3">
							{unreadCount > 0 && (
								<button
									type="button"
									onClick={() => submit({ intent: 'readAll' })}
									className="text-xs font-medium text-brand-600 hover:text-brand-700"
								>
									Mark all as read
								</button>
							)}
							{hasRead && (
								<button
									type="button"
									onClick={() => submit({ intent: 'deleteRead' })}
									className="text-xs font-medium text-gray-600 hover:text-gray-900"
								>
									Clear read
								</button>
							)}
						</div>
					</div>
					<ul className="max-h-96 divide-y divide-gray-200 overflow-auto">
						{notifications.map((notification) => (
							<li
								key={notification.notificationID}
								className={`flex items-start hover:bg-gray-50 ${
									notification.isRead ? '' : 'bg-brand-50'
								}`}
							>
								<button
									type="button"
									onClick={() => open(notification)}
									className="flex min-w-0 flex-1 gap-3 py-3 pl-4 pr-2 text-left"
								>
									<span
										className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
											notification.isRead ? 'bg-transparent' : 'bg-brand-600'
										}`}
										aria-hidden="true"
									/>
									<span className="min-w-0">
										<span className="block text-sm font-medium text-gray-900">
											{notification.title}
										</span>
										<span className="block text-sm text-gray-600">
											{notification.message}
										</span>
										<span className="mt-0.5 block text-xs text-gray-500">
											{timeAgo(notification.creationDate)}
										</span>
									</span>
								</button>
								{notification.isRead && (
									<button
										type="button"
										onClick={() =>
											submit({
												intent: 'delete',
												notificationID: notification.notificationID,
											})
										}
										aria-label={`Delete notification: ${notification.title}`}
										title="Delete"
										className="mr-2 mt-2.5 rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
									>
										<svg
											className="h-4 w-4"
											fill="none"
											viewBox="0 0 24 24"
											stroke="currentColor"
											strokeWidth="2"
											aria-hidden="true"
										>
											<path
												strokeLinecap="round"
												strokeLinejoin="round"
												d="M6 18L18 6M6 6l12 12"
											/>
										</svg>
									</button>
								)}
							</li>
						))}
						{data && notifications.length === 0 && (
							<li className="px-4 py-6 text-center text-sm text-gray-500">
								No notifications yet
							</li>
						)}
					</ul>
				</div>
			)}
		</div>
	)
}
