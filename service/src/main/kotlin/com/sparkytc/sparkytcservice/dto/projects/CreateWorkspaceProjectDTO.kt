package com.sparkytc.sparkytcservice.dto.projects

data class CreateWorkspaceProjectDTO(
    val title: String,
    val projectShortCode: String,
    val description: String?
)