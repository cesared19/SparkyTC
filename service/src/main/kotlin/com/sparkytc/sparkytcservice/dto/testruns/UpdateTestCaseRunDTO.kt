package com.sparkytc.sparkytcservice.dto.testruns

data class UpdateTestCaseRunDTO(
    val status: TestCaseRunStatus,
    val notes: String?,
)