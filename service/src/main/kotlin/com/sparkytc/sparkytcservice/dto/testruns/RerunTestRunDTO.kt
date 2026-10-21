package com.sparkytc.sparkytcservice.dto.testruns

import java.util.UUID

/** A new test run with the test cases of another one that ended with the given results, e.g. failed and blocked. */
data class RerunTestRunDTO(
    val statuses: List<TestCaseRunStatus>,
    val buildID: UUID? = null,
    // "<title> (re-run)" when empty
    val title: String? = null,
)
