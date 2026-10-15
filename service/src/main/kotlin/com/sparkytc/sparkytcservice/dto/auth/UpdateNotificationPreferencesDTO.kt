package com.sparkytc.sparkytcservice.dto.auth

data class UpdateNotificationPreferencesDTO(
    val testRunAssigned: Boolean,
    val testRunCompleted: Boolean
)
