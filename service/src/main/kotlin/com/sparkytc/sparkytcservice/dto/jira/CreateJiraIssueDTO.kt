package com.sparkytc.sparkytcservice.dto.jira

data class CreateJiraIssueDTO(
    val summary: String,
    val stepsToReproduce: String,
    val expectedResult: String,
    val actualResult: String,
    val buildNumber: String,
    // the URL users reach SparkyTC at, used to link back from jira to the test case and its attachments
    val appBaseURL: String?
)
