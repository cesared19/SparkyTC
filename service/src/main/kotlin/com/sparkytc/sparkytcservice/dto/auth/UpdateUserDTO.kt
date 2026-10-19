package com.sparkytc.sparkytcservice.dto.auth

import com.fasterxml.jackson.annotation.JsonProperty

data class UpdateUserDTO(
    val displayName: String,
    val role: UserRole,
    @JsonProperty("isActive")
    val isActive: Boolean,
    // when set, resets the user's password, only the super admin can do this
    val password: String? = null
)
