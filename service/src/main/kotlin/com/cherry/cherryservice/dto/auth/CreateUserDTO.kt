package com.cherry.cherryservice.dto.auth

data class CreateUserDTO(
    val username: String,
    val displayName: String,
    val role: UserRole,
    val password: String
)
