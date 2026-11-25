import type { DeviceMode, JiraFailureMode } from './types'

export interface Project {
	projectID: string
	creationDate: number
	title: string
	projectShortCode: string
	description?: string
	jiraFailureMode: JiraFailureMode
	jiraProjectKey?: string
	jiraIssueType?: string
	// whether results say which SparkStock device they were recorded on
	deviceMode: DeviceMode
}

export type NewProject = {
	title: string
	projectShortCode: string
	description?: string
}
