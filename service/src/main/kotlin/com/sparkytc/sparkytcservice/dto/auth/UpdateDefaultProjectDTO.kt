package com.sparkytc.sparkytcservice.dto.auth

data class UpdateDefaultProjectDTO(
    // null clears the default project
    val projectShortCode: String?
)
