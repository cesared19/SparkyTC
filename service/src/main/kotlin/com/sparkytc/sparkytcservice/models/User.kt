package com.sparkytc.sparkytcservice.models

import com.sparkytc.sparkytcservice.dto.auth.UserDTO
import com.sparkytc.sparkytcservice.dto.auth.UserRole
import com.sparkytc.sparkytcservice.dto.auth.UserTheme
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

    @Column(name = "theme", nullable = false)
    @Enumerated(EnumType.STRING)
    var theme: UserTheme = UserTheme.SYSTEM,

    // the project shown after signing in
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "default_project_id")
    var defaultProject: WorkspaceProject? = null,
) {
    fun toDTO(projectIDs: List<UUID>? = null): UserDTO {
        return UserDTO(externalID, creationDate, username, displayName, role, isActive, theme, defaultProject?.projectShortCode, projectIDs)
    }
}
