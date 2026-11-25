import { ResultDevice, StockDevice } from '~/models/types'

/** How a device reads in results, e.g. "VR Headset 1 (VR-0001) · Focus 3 · SKQ1.230810.001". */
export function deviceText(device: ResultDevice | StockDevice) {
	const name =
		device.name && device.name !== device.ref
			? `${device.name} (${device.ref})`
			: device.ref
	return [
		name,
		device.model !== device.name ? device.model : undefined,
		device.version,
	]
		.filter(Boolean)
		.join(' · ')
}

const rememberKey = (testRunID: string) => `sparky.device.${testRunID}`

/** The device used last in this test run, kept in the browser so the next test case starts with it. */
export function rememberedDevice(testRunID: string) {
	try {
		return window.localStorage.getItem(rememberKey(testRunID)) ?? ''
	} catch {
		return ''
	}
}

export function rememberDevice(testRunID: string, ref: string) {
	try {
		if (ref) window.localStorage.setItem(rememberKey(testRunID), ref)
	} catch {
		// private windows can refuse storage, the picker still works
	}
}
