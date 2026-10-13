package com.cherry.cherryservice.dto.testruns

data class UpdateTestCaseRunDetailsDTO(
    val title: String,
    val description: String?,
    val testInstructions: String?,
    // when true, the changes are also applied to the source test case so future test runs pick them up
    val applyToTestCase: Boolean = false,
)
