package com.sparkytc.sparkytcservice.repositories

import com.sparkytc.sparkytcservice.models.ProjectBuild
import com.sparkytc.sparkytcservice.models.WorkspaceProject
import org.springframework.data.jpa.repository.JpaRepository
import java.util.UUID

interface ProjectBuildRepository : JpaRepository<ProjectBuild, Long> {
    fun findByExternalID(externalID: UUID): ProjectBuild?

    // newest first, the first one is the project's current build
    fun findAllByProjectOrderByIdDesc(project: WorkspaceProject): List<ProjectBuild>

    fun findTopByProjectOrderByIdDesc(project: WorkspaceProject): ProjectBuild?

    fun findByProjectAndBuildNumberIgnoreCase(project: WorkspaceProject, buildNumber: String): ProjectBuild?
}
