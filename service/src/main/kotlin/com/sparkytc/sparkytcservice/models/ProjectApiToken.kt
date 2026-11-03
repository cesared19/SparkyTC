package com.sparkytc.sparkytcservice.models

import com.sparkytc.sparkytcservice.dto.integration.ProjectApiTokenDTO
import jakarta.persistence.*
import org.hibernate.annotations.CreationTimestamp
import java.util.*

/**
 * A token another application uses to read one project through the integration API, and to create in it when
 * it can write. Only its SHA-256 hash is kept; the token itself is shown once, when it's created.
 */
@Entity(name = "project_api_tokens")
class ProjectApiToken(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,

    @Column(name = "external_id")
    val externalID: UUID = UUID.randomUUID(),

    @Column(name = "creation_date")
    @CreationTimestamp
    val creationDate: Date = Date(),

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "project_id")
    val project: WorkspaceProject,

    @Column(name = "name", nullable = false)
    val name: String,

    @Column(name = "token_hash", nullable = false)
    val tokenHash: String,

    // the start of the token, to tell tokens apart in the list
    @Column(name = "token_prefix", nullable = false)
    val tokenPrefix: String,

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by_id")
    val createdBy: User? = null,

    @Column(name = "last_used_at")
    var lastUsedAt: Date? = null,

    // read and write tokens also create sections, test cases and test plans
    @Column(name = "can_write", nullable = false)
    val canWrite: Boolean = false,

    // a revoked token no longer works, but stays so what it created keeps its name
    @Column(name = "revoked_at")
    var revokedAt: Date? = null,
) {
    /** How what it created shows its author, e.g. "co-bord (API token)". */
    val authorName: String
        get() = "$name (API token)"

    fun toDTO(): ProjectApiTokenDTO {
        return ProjectApiTokenDTO(externalID, name, tokenPrefix, creationDate, createdBy?.displayName, lastUsedAt, canWrite)
    }
}
