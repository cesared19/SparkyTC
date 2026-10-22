package com.sparkytc.sparkytcservice.dto.bulk

import com.sparkytc.sparkytcservice.dto.steps.TestCaseFormat
import java.util.UUID

/** One change applied to several test cases at once; only the fields that are set change. */
data class BulkEditTestCasesDTO(
    val testCaseIDs: List<UUID>,
    val sectionID: UUID? = null,
    val addLabels: List<String> = emptyList(),
    val removeLabels: List<String> = emptyList(),
    // the property to set; an empty value clears it when it's optional
    val propertyID: UUID? = null,
    val propertyValue: String? = null,
    val format: TestCaseFormat? = null,
)

data class BulkDeleteTestCasesDTO(
    val testCaseIDs: List<UUID>,
)

data class BulkAssignTestCaseRunsDTO(
    val testCaseRunIDs: List<UUID>,
    // empty gives them back
    val userID: UUID? = null,
)

data class BulkEditResultDTO(
    val updated: Int = 0,
    // test cases used by test runs are archived instead of deleted
    val archived: Int = 0,
    val deleted: Int = 0,
)
