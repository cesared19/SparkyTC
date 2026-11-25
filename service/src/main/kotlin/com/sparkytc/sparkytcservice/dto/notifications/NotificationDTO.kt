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
    val isRead: Boolean,
    // the app that sent an EXTERNAL notification
    val appName: String? = null,
)

/** A notification another app of the suite sends to a SparkyTC user (POST /api/system/v1/notifications). */
data class ExternalNotificationDTO(
    // the SparkyTC user's ID (as in /auth/me)
    val userID: UUID? = null,
    // the app's name, shown with the notification, e.g. SparkStock
    val app: String? = null,
    val title: String? = null,
    val message: String? = null,
    // a full address in the other app, opened in a new tab
    val link: String? = null,
    // the app's reference: the same one twice for a user keeps a single notification
    val sourceRef: String? = null,
)

data class ExternalNotificationResultDTO(
    val created: Boolean,
    val notificationID: UUID? = null,
    // why nothing was created for the user, e.g. they turned these notifications off
    val skipped: String? = null,
)

data class NotificationListDTO(
    val unreadCount: Long,
    val notifications: List<NotificationDTO>
)
