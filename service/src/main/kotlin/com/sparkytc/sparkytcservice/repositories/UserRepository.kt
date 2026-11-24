package com.sparkytc.sparkytcservice.repositories

import com.sparkytc.sparkytcservice.dto.auth.UserRole
import com.sparkytc.sparkytcservice.models.User
import jakarta.persistence.LockModeType
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Lock
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param
import java.util.UUID

interface UserRepository : JpaRepository<User, Long> {
    fun findByExternalID(externalID: UUID): User?

    /** The user, locked until the transaction ends, so changes that replace several rows of theirs wait for each other. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT u FROM users u WHERE u.id = :id")
    fun findByIDForUpdate(@Param("id") id: Long): User?

    fun findByUsernameIgnoreCase(username: String): User?

    fun findAllByOrderByUsernameAsc(): List<User>

    fun countByRoleAndIsActiveTrue(role: UserRole): Long

    fun findByIsSuperAdminTrue(): User?
}
