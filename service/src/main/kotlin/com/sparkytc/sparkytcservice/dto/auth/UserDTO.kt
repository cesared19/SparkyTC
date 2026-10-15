package com.sparkytc.sparkytcservice.dto.auth

import com.fasterxml.jackson.annotation.JsonProperty
import java.util.Date
import java.util.UUID

data class UserDTO(
    val userID: UUID,
    val creationDate: Date,
    val username: String,
    val displayName: String,
    val role: UserRole,
    @JsonProperty("isActive")
    val isActive: Boolean
)
