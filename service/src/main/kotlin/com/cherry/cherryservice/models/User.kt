package com.cherry.cherryservice.models

import com.cherry.cherryservice.dto.auth.UserDTO
import com.cherry.cherryservice.dto.auth.UserRole
import jakarta.persistence.*
import org.hibernate.annotations.CreationTimestamp
import org.hibernate.annotations.UpdateTimestamp
import java.util.*

@Entity(name = "users")
class User(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,

    @Column(name = "external_id")
    val externalID: UUID = UUID.randomUUID(),

    @Column(name = "creation_date")
    @CreationTimestamp
    val creationDate: Date = Date(),

    @Column(name = "modify_date")
    @UpdateTimestamp
    val modifyDate: Date = Date(),

    @Column(name = "username", nullable = false)
    val username: String,

    @Column(name = "display_name", nullable = false)
    var displayName: String,

    @Column(name = "password_hash", nullable = false)
    var passwordHash: String,

    @Column(name = "role", nullable = false)
    @Enumerated(EnumType.STRING)
    var role: UserRole,

    @Column(name = "is_active", nullable = false)
    var isActive: Boolean = true,
) {
    fun toDTO(): UserDTO {
        return UserDTO(externalID, creationDate, username, displayName, role, isActive)
    }
}
