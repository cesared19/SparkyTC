package com.sparkytc.sparkytcservice.dto.auth

data class UpdateNotificationPreferencesDTO(
    val testRunAssigned: Boolean,
    val testRunCompleted: Boolean,
    // reminders from other apps of the suite; null keeps the current choice
    val external: Boolean? = null,
)
