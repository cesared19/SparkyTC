package com.sparkytc.sparkytcservice.models

import com.sparkytc.sparkytcservice.dto.integration.ProjectApiTokenDTO
import jakarta.persistence.*
import org.hibernate.annotations.CreationTimestamp
import java.util.*

/**
 * A token another application uses to read one project through the integration API. Only its SHA-256 hash is
 * kept; the token itself is shown once, when it's created.
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
) {
    fun toDTO(): ProjectApiTokenDTO {
        return ProjectApiTokenDTO(externalID, name, tokenPrefix, creationDate, createdBy?.displayName, lastUsedAt)
    }
}
