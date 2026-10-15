package com.sparkytc.sparkytcservice.dto

import java.util.UUID

data class UpdateDTO<T>(
    val id: UUID,
    val data: T
)