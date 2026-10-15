package com.sparkytc.sparkytcservice.repositories

import com.sparkytc.sparkytcservice.models.Notification
import com.sparkytc.sparkytcservice.models.User
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Modifying
import org.springframework.data.jpa.repository.Query
import java.util.UUID

interface NotificationRepository : JpaRepository<Notification, Long> {
    fun findTop30ByUserOrderByCreationDateDesc(user: User): List<Notification>

    fun countByUserAndIsReadFalse(user: User): Long

    fun findByExternalIDAndUser(externalID: UUID, user: User): Notification?

    @Modifying
    @Query("UPDATE notifications n SET n.isRead = true WHERE n.user = :user AND n.isRead = false")
    fun markAllRead(user: User)
}
