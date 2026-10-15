package com.sparkytc.sparkytcservice.models

import com.sparkytc.sparkytcservice.dto.notifications.NotificationDTO
import com.sparkytc.sparkytcservice.dto.notifications.NotificationType
import jakarta.persistence.*
import org.hibernate.annotations.CreationTimestamp
import java.util.*

@Entity(name = "notifications")
class Notification(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,

    @Column(name = "external_id")
    val externalID: UUID = UUID.randomUUID(),

    @Column(name = "creation_date")
    @CreationTimestamp
    val creationDate: Date = Date(),

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id")
    val user: User,

    @Column(name = "type", nullable = false)
    @Enumerated(EnumType.STRING)
    val type: NotificationType,

    @Column(name = "title", nullable = false)
    val title: String,

    @Column(name = "message", nullable = false)
    val message: String,

    // path within the application the notification opens
    @Column(name = "link")
    val link: String?,

    @Column(name = "is_read", nullable = false)
    var isRead: Boolean = false,
) {
    fun toDTO(): NotificationDTO {
        return NotificationDTO(externalID, creationDate, type, title, message, link, isRead)
    }
}
