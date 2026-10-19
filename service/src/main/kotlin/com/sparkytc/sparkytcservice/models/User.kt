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

    @Column(name = "notify_test_run_assigned", nullable = false)
    var notifyTestRunAssigned: Boolean = true,

    @Column(name = "notify_test_run_completed", nullable = false)
    var notifyTestRunCompleted: Boolean = true,

    // the ADMIN_USERNAME account, the only one that can reset other users' passwords
    @Column(name = "is_super_admin", nullable = false)
    var isSuperAdmin: Boolean = false,
) {
    fun toDTO(projectIDs: List<UUID>? = null): UserDTO {
        return UserDTO(externalID, creationDate, username, displayName, role, isActive, theme, defaultProject?.projectShortCode, projectIDs, notifyTestRunAssigned, notifyTestRunCompleted, isSuperAdmin)
    }
}
