package com.cherry.cherryservice.dto.auth

import java.util.Date

data class LoginResponseDTO(
    val token: String,
    val expiresAt: Date,
    val user: UserDTO
)
