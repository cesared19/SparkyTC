package com.sparkytc.sparkytcservice.dto.integration

import java.util.Date
import java.util.UUID

data class ProjectApiTokenDTO(
    val tokenID: UUID,
    val name: String,
    val tokenPrefix: String,
    val creationDate: Date,
    val createdBy: String?,
    val lastUsedAt: Date?,
)

data class CreateProjectApiTokenDTO(val name: String?)

/** The new token, with the secret that is shown only this once. */
data class CreatedProjectApiTokenDTO(val token: ProjectApiTokenDTO, val secret: String)
