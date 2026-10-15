package com.cherry.cherryservice.dto.jira

data class CreateJiraIssueDTO(
    val summary: String,
    val stepsToReproduce: String,
    val expectedResult: String,
    val actualResult: String,
    val buildNumber: String,
    // the URL users reach cherry at, used to link back from jira to the test case and its attachments
    val cherryBaseURL: String?
)
