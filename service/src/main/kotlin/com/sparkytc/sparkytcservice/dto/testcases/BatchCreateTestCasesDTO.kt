package com.sparkytc.sparkytcservice.dto.testcases

import java.util.UUID

data class BatchCreateTestCasesDTO(
    val testCases: List<CreateTestCaseDTO>,
    // where the imported test cases go, unless a row sets its own
    val sectionID: UUID? = null,
)
