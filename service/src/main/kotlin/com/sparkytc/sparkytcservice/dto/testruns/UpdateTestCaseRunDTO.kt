package com.sparkytc.sparkytcservice.dto.testruns

import com.sparkytc.sparkytcservice.dto.jira.JiraIssueTransitionDTO
import com.sparkytc.sparkytcservice.dto.steps.StepResultDTO

data class UpdateTestCaseRunDTO(
    val status: TestCaseRunStatus,
    val notes: String?,
    // where users reach SparkyTC, used for links in automatically created Jira issues
    val appBaseURL: String? = null,
    // time typed in when the timer wasn't used, only kept if the test case has no time yet
    val manualSeconds: Long? = null,
    // linked issues to close on a pass or reopen on a fail
    val jiraTransitions: List<JiraIssueTransitionDTO> = emptyList(),
    // how each step went, for test cases written as steps
    val stepResults: List<StepResultDTO> = emptyList(),
)
