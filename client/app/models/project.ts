import type { JiraFailureMode } from './types'

export interface Project {
	projectID: string
	creationDate: number
	title: string
	projectShortCode: string
	description?: string
	jiraFailureMode: JiraFailureMode
	jiraProjectKey?: string
	jiraIssueType?: string
}

export interface NewProject extends Record<string, any> {
	title: string
	projectShortCode: string
	description?: string
}
