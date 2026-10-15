package com.sparkytc.sparkytcservice.dto.auth

data class ChangePasswordDTO(
    val currentPassword: String,
    val newPassword: String
)
