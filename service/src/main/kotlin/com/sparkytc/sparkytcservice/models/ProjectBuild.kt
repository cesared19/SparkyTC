package com.sparkytc.sparkytcservice.models

import com.sparkytc.sparkytcservice.dto.builds.ProjectBuildDTO
import jakarta.persistence.*
import org.hibernate.annotations.CreationTimestamp
import org.hibernate.annotations.UpdateTimestamp
import java.util.*

/** A build of the product under test, registered by an admin. The newest one is the project's current build. */
@Entity(name = "project_builds")
class ProjectBuild(
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

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "project_id")
    val project: WorkspaceProject,

    @Column(name = "build_number", nullable = false)
    var buildNumber: String,

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by_id")
    val createdBy: User? = null,
) {
    fun toDTO(): ProjectBuildDTO {
        return ProjectBuildDTO(externalID, buildNumber, creationDate, createdBy?.displayName)
    }
}
