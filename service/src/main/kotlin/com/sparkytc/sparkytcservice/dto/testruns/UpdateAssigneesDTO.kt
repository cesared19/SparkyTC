package com.sparkytc.sparkytcservice.dto.testruns

import java.util.UUID

data class UpdateTestRunAssigneesDTO(
    val userIDs: List<UUID>
)

data class UpdateTestCaseRunAssigneeDTO(
    // null leaves the test case unassigned
    val userID: UUID?
)
