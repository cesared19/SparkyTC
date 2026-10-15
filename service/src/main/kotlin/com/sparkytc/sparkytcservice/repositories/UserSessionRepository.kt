package com.sparkytc.sparkytcservice.repositories

import com.sparkytc.sparkytcservice.models.User
import com.sparkytc.sparkytcservice.models.UserSession
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Modifying
import org.springframework.data.jpa.repository.Query
import java.util.Date

interface UserSessionRepository : JpaRepository<UserSession, Long> {
    fun findByTokenHash(tokenHash: String): UserSession?

    fun deleteAllByUser(user: User)

    fun deleteByTokenHash(tokenHash: String)

    @Modifying
    @Query("DELETE FROM user_sessions s WHERE s.expiresAt < :now")
    fun deleteExpired(now: Date)
}
