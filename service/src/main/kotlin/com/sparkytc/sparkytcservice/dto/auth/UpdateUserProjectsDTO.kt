package com.sparkytc.sparkytcservice.dto.auth

import java.util.UUID

data class UpdateUserProjectsDTO(
    val projectIDs: List<UUID>
)
