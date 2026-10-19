package com.sparkytc.sparkytcservice.dto.testruns

import java.util.UUID

data class UpdateTestRunBuildDTO(
    // null clears the build
    val buildID: UUID?
)
