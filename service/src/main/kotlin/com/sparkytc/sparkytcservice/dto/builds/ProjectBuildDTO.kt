package com.sparkytc.sparkytcservice.dto.builds

import java.util.Date
import java.util.UUID

data class ProjectBuildDTO(
    val buildID: UUID,
    val buildNumber: String,
    val creationDate: Date,
    val createdBy: String? = null
)
