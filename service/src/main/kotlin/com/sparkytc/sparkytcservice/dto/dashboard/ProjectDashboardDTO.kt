package com.sparkytc.sparkytcservice.dto.dashboard

import com.sparkytc.sparkytcservice.dto.projects.WorkspaceProjectDTO
import com.sparkytc.sparkytcservice.dto.testruns.TestCaseRunStatus
import com.sparkytc.sparkytcservice.dto.testruns.TestRunStatus
import java.util.Date
import java.util.UUID

data class ProjectDashboardDTO(
    val project: WorkspaceProjectDTO,
    val testCaseCount: Int,
    // test case counts per option of each option select property, e.g. Priority and Type
    val propertyBreakdowns: List<PropertyBreakdownDTO>,
    val testRunCounts: Map<TestRunStatus, Int>,
    val activeTestRuns: List<TestRunSummaryDTO>,
    val recentTestRuns: List<TestRunSummaryDTO>,
    val linkedJiraIssueCount: Int,
)

data class PropertyBreakdownDTO(
    val title: String,
    val counts: List<ValueCountDTO>,
)

data class ValueCountDTO(
    val value: String,
    val count: Int,
)

data class TestRunSummaryDTO(
    val testRunID: UUID,
    val testRunNumber: Long,
    val title: String,
    val status: TestRunStatus,
    val creationDate: Date,
    val createdBy: String?,
    val totalCount: Int,
    val resultCounts: Map<TestCaseRunStatus, Int>,
)
