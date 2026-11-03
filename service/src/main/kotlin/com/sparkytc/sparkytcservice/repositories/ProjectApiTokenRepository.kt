package com.sparkytc.sparkytcservice.repositories

import com.sparkytc.sparkytcservice.models.ProjectApiToken
import com.sparkytc.sparkytcservice.models.WorkspaceProject
import org.springframework.data.jpa.repository.JpaRepository
import java.util.UUID

interface ProjectApiTokenRepository : JpaRepository<ProjectApiToken, Long> {
    fun findByTokenHash(tokenHash: String): ProjectApiToken?
    fun findByExternalID(externalID: UUID): ProjectApiToken?
    fun findAllByProjectAndRevokedAtIsNullOrderByCreationDateDesc(project: WorkspaceProject): List<ProjectApiToken>
}
