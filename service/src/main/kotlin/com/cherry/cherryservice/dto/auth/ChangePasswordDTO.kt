package com.cherry.cherryservice.dto.auth

data class ChangePasswordDTO(
    val currentPassword: String,
    val newPassword: String
)
