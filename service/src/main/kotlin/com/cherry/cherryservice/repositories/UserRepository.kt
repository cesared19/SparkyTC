package com.cherry.cherryservice.repositories

import com.cherry.cherryservice.dto.auth.UserRole
import com.cherry.cherryservice.models.User
import org.springframework.data.jpa.repository.JpaRepository
import java.util.UUID

interface UserRepository : JpaRepository<User, Long> {
    fun findByExternalID(externalID: UUID): User?

    fun findByUsernameIgnoreCase(username: String): User?

    fun findAllByOrderByUsernameAsc(): List<User>

    fun countByRoleAndIsActiveTrue(role: UserRole): Long
}
