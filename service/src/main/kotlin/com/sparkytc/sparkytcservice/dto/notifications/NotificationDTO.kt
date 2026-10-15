package com.sparkytc.sparkytcservice.dto.notifications

import com.fasterxml.jackson.annotation.JsonProperty
import java.util.Date
import java.util.UUID

data class NotificationDTO(
    val notificationID: UUID,
    val creationDate: Date,
    val type: NotificationType,
    val title: String,
    val message: String,
    val link: String?,
    @JsonProperty("isRead")
    val isRead: Boolean
)

data class NotificationListDTO(
    val unreadCount: Long,
    val notifications: List<NotificationDTO>
)
