package com.sparkytc.sparkytcservice.dto.testruns

data class UpdateTestRunDTO(
    val title: String,
    val description: String?,
    val status: TestRunStatus
) 