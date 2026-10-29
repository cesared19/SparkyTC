import { useCallback, useEffect, useRef, useState } from 'react'
import { ResultDraft } from '~/models/types'
import { Route } from '~/utility/Routes'

// how long to wait after the last change before keeping the draft
const SAVE_DELAY_MS = 800

export type DraftState = 'idle' | 'saving' | 'saved' | 'error'

/**
 * Keeps the result being prepared for a test case on the server as the tester works, so leaving the page or
 * switching devices loses nothing. It talks to the draft route directly instead of through a fetcher, so
 * typing doesn't reload the run's data.
 */
export function useResultDraft(testCaseRunID: string, enabled: boolean) {
	const url = Route.resultDraft(testCaseRunID)
	const [loaded, setLoaded] = useState<ResultDraft | null>()
	const [state, setState] = useState<DraftState>('idle')
	const [savedAt, setSavedAt] = useState<number>()
	const timer = useRef<ReturnType<typeof setTimeout>>()
	const pending = useRef<string>()
	// what the server has, to skip saves that change nothing
	const lastSent = useRef<string>()

	// the draft kept from before, or null when there's none
	useEffect(() => {
		if (!enabled) {
			setLoaded(null)
			return
		}
		let isCurrent = true
		fetch(url)
			.then((response) => (response.ok ? response.json() : null))
			.then((draft: ResultDraft | null) => {
				if (!isCurrent) return
				const hasContent =
					!!draft &&
					(!!draft.status ||
						!!draft.notes ||
						(draft.stepResults?.length ?? 0) > 0)
				setLoaded(hasContent ? draft : null)
				if (hasContent) setSavedAt(draft?.updatedAt)
			})
			.catch(() => isCurrent && setLoaded(null))
		return () => {
			isCurrent = false
		}
	}, [url, enabled])

	const send = useCallback(
		(body: string, keepalive = false) => {
			pending.current = undefined
			lastSent.current = body
			setState('saving')
			return fetch(url, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body,
				// lets the request finish when the page is being left
				keepalive,
			})
				.then((response) => {
					if (!response.ok) throw new Error(`status ${response.status}`)
					setState('saved')
					setSavedAt(Date.now())
				})
				.catch(() => {
					// try again with the next change
					lastSent.current = undefined
					setState('error')
				})
		},
		[url]
	)

	/** Keeps the draft shortly after the last change. */
	const saveLater = useCallback(
		(draft: ResultDraft) => {
			const body = JSON.stringify(draft)
			if (body === (pending.current ?? lastSent.current)) return
			pending.current = body
			clearTimeout(timer.current)
			timer.current = setTimeout(() => send(body), SAVE_DELAY_MS)
		},
		[send]
	)

	/** Sends a change still waiting, e.g. when the tester leaves the page. */
	const flush = useCallback(() => {
		clearTimeout(timer.current)
		if (pending.current) send(pending.current, true)
	}, [send])

	/** Drops a change still waiting, when the result itself is being saved. */
	const cancel = useCallback(() => {
		clearTimeout(timer.current)
		pending.current = undefined
	}, [])

	const discard = useCallback(() => {
		cancel()
		lastSent.current = undefined
		setState('idle')
		setSavedAt(undefined)
		return fetch(url, { method: 'DELETE' }).catch(() => undefined)
	}, [cancel, url])

	// leaving the page or putting the browser in the background keeps what's waiting
	useEffect(() => {
		const onHide = () => flush()
		const onVisibility = () => document.visibilityState === 'hidden' && flush()
		window.addEventListener('pagehide', onHide)
		document.addEventListener('visibilitychange', onVisibility)
		return () => {
			window.removeEventListener('pagehide', onHide)
			document.removeEventListener('visibilitychange', onVisibility)
			flush()
		}
	}, [flush])

	return { loaded, state, savedAt, saveLater, cancel, discard }
}
