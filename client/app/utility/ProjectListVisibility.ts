import { useSyncExternalStore } from 'react'

const STORAGE_KEY = 'sparky.projectListHidden'
const CHANGE_EVENT = 'projectlistchange'

/**
 * Applied before the first paint, like the theme, so a hidden project list doesn't flash while the page loads.
 * It marks <html data-project-list="hidden">, which the styles of the list and its show button follow.
 */
export const PROJECT_LIST_SCRIPT = `(function(){try{if(localStorage.getItem('${STORAGE_KEY}')==='1'){document.documentElement.dataset.projectList='hidden'}}catch(e){}})()`

/** Hides or shows the project list on desktop, and remembers it in this browser. */
export function setProjectListHidden(hidden: boolean) {
	if (hidden) {
		document.documentElement.dataset.projectList = 'hidden'
	} else {
		delete document.documentElement.dataset.projectList
	}
	try {
		if (hidden) localStorage.setItem(STORAGE_KEY, '1')
		else localStorage.removeItem(STORAGE_KEY)
	} catch {
		// private windows can refuse storage: it still works until the page is closed
	}
	window.dispatchEvent(new Event(CHANGE_EVENT))
}

function subscribe(onChange: () => void) {
	window.addEventListener(CHANGE_EVENT, onChange)
	return () => window.removeEventListener(CHANGE_EVENT, onChange)
}

/** Whether the project list is hidden on desktop. The server always renders it shown. */
export function useProjectListHidden() {
	return useSyncExternalStore(
		subscribe,
		() => document.documentElement.dataset.projectList === 'hidden',
		() => false
	)
}
