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
    val isActive: Boolean,
    val theme: UserTheme = UserTheme.SYSTEM,
    val defaultProjectShortCode: String? = null,
    // only included in the admin user list
    val projectIDs: List<UUID>? = null,
    val notifyTestRunAssigned: Boolean = true,
    val notifyTestRunCompleted: Boolean = true,
    @JsonProperty("isSuperAdmin")
    val isSuperAdmin: Boolean = false,
    val jiraAccountID: String? = null,
    val jiraDisplayName: String? = null
)
