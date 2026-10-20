package com.sparkytc.sparkytcservice.dto.testruns

data class UpdateTestCaseRunDTO(
    val status: TestCaseRunStatus,
    val notes: String?,
    // where users reach SparkyTC, used for links in automatically created Jira issues
    val appBaseURL: String? = null,
    // time typed in when the timer wasn't used, only kept if the test case has no time yet
    val manualSeconds: Long? = null,
)