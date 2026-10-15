package com.sparkytc.sparkytcservice.dto.auth

import java.util.UUID

data class UserSummaryDTO(
    val userID: UUID,
    val displayName: String
)
