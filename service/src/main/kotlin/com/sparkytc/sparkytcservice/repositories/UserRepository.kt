package com.sparkytc.sparkytcservice.repositories

import com.sparkytc.sparkytcservice.dto.auth.UserRole
import com.sparkytc.sparkytcservice.models.User
import org.springframework.data.jpa.repository.JpaRepository
import java.util.UUID

interface UserRepository : JpaRepository<User, Long> {
    fun findByExternalID(externalID: UUID): User?

    fun findByUsernameIgnoreCase(username: String): User?

    fun findAllByOrderByUsernameAsc(): List<User>

    fun countByRoleAndIsActiveTrue(role: UserRole): Long
}
